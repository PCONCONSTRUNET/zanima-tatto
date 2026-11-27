import "server-only";
import {
  Prisma,
  type AppointmentStatus,
  type PaymentMethod,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dispatchNotification, notifyStudioAdmins } from "@/lib/notifications";

export class ScheduleConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleConflictError";
  }
}

const INACTIVE_STATUSES: AppointmentStatus[] = ["CANCELLED", "NO_SHOW"];

export async function assertNoScheduleConflict(
  tx: Prisma.TransactionClient,
  params: {
    startAt: Date;
    endAt: Date;
    bufferAfterMinutes: number;
    excludeAppointmentId?: string;
    ignoreWorkingHours?: boolean;
  }
) {
  const effectiveEnd = new Date(
    params.endAt.getTime() + Math.max(0, params.bufferAfterMinutes) * 60_000
  );

  // 1. Verificar bloqueios explícitos de agenda
  const conflictingBlock = await tx.availabilityBlock.findFirst({
    where: {
      startAt: { lt: effectiveEnd },
      endAt: { gt: params.startAt },
    },
    select: { id: true, title: true, startAt: true, endAt: true },
  });

  if (conflictingBlock) {
    throw new ScheduleConflictError(
      `Horário indisponível devido ao bloqueio "${conflictingBlock.title}".`
    );
  }

  // 2. Verificar sobreposição com qualquer atendimento ativo (incluindo intervalo pós-sessão)
  const candidates = await tx.appointment.findMany({
    where: {
      id: params.excludeAppointmentId
        ? { not: params.excludeAppointmentId }
        : undefined,
      status: { notIn: INACTIVE_STATUSES },
      startAt: { lt: effectiveEnd },
      endAt: {
        gt: new Date(params.startAt.getTime() - 120 * 60_000),
      },
    },
    select: {
      id: true,
      title: true,
      startAt: true,
      endAt: true,
      bufferAfterMinutes: true,
    },
  });

  for (const existing of candidates) {
    const existingEffectiveEnd = new Date(
      existing.endAt.getTime() +
        Math.max(0, existing.bufferAfterMinutes) * 60_000
    );
    if (existing.startAt < effectiveEnd && existingEffectiveEnd > params.startAt) {
      throw new ScheduleConflictError(
        `Conflito de horário com o atendimento "${existing.title}". Escolha outro horário.`
      );
    }
  }
}

export async function createAppointmentSafely(params: {
  clientId: string;
  artistUserId: string;
  projectId?: string | null;
  serviceId?: string | null;
  title: string;
  description?: string | null;
  startAt: Date;
  durationMinutes: number;
  bufferAfterMinutes: number;
  status: AppointmentStatus;
  sessionNumber?: number;
  totalSessions?: number;
  recurrenceGroupId?: string | null;
  priceEstimate?: number | null;
  depositRequired?: number | null;
  preferredPaymentMethod?: PaymentMethod | null;
  clientNotes?: string | null;
  internalNotes?: string | null;
  changedByUserId?: string | null;
}) {
  const endAt = new Date(
    params.startAt.getTime() + params.durationMinutes * 60_000
  );

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await assertNoScheduleConflict(tx, {
            startAt: params.startAt,
            endAt,
            bufferAfterMinutes: params.bufferAfterMinutes,
          });

          const created = await tx.appointment.create({
            data: {
              clientId: params.clientId,
              artistUserId: params.artistUserId,
              projectId: params.projectId ?? null,
              serviceId: params.serviceId ?? null,
              title: params.title,
              description: params.description ?? null,
              startAt: params.startAt,
              endAt,
              durationMinutes: params.durationMinutes,
              bufferAfterMinutes: params.bufferAfterMinutes,
              status: params.status,
              sessionNumber: params.sessionNumber ?? 1,
              totalSessions: params.totalSessions ?? 1,
              recurrenceGroupId: params.recurrenceGroupId ?? null,
              priceEstimate:
                params.priceEstimate !== undefined && params.priceEstimate !== null
                  ? params.priceEstimate
                  : null,
              depositRequired:
                params.depositRequired !== undefined &&
                params.depositRequired !== null
                  ? params.depositRequired
                  : null,
              preferredPaymentMethod: params.preferredPaymentMethod ?? null,
              clientNotes: params.clientNotes ?? null,
              internalNotes: params.internalNotes ?? null,
              confirmedAt: params.status === "CONFIRMED" ? new Date() : null,
            },
          });

          await tx.appointmentHistory.create({
            data: {
              appointmentId: created.id,
              changedByUserId: params.changedByUserId ?? null,
              previousStatus: null,
              newStatus: created.status,
              newStartAt: created.startAt,
              reason: "Agendamento criado",
            },
          });

          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (err) {
      // Retry em conflito de serialização (P2034) por concorrência simultânea
      const code = (err as { code?: string })?.code;
      if (code === "P2034" && attempt < 2) {
        continue;
      }
      throw err;
    }
  }

  throw new ScheduleConflictError(
    "Não foi possível reservar este horário devido a uma reserva simultânea."
  );
}

export async function getAvailableSlotsForDate(
  dateStr: string,
  durationMinutes = 60
): Promise<Array<{ startTime: string; endTime: string; available: boolean }>> {
  // Calcula dia da semana em America/Sao_Paulo
  const refDate = new Date(`${dateStr}T12:00:00-03:00`);
  if (Number.isNaN(refDate.getTime())) return [];

  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(refDate);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdayMap[weekdayName] ?? 0;

  const rule = await prisma.availabilityRule.findUnique({
    where: { dayOfWeek },
  });
  if (!rule || !rule.isActive) return [];

  const [startH, startM] = rule.startTime.split(":").map(Number);
  const [endH, endM] = rule.endTime.split(":").map(Number);
  const dayStart = new Date(`${dateStr}T00:00:00-03:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59-03:00`);

  const [blocks, appointments] = await Promise.all([
    prisma.availabilityBlock.findMany({
      where: { startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
    }),
    prisma.appointment.findMany({
      where: {
        status: { notIn: INACTIVE_STATUSES },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
      select: { startAt: true, endAt: true, bufferAfterMinutes: true },
    }),
  ]);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const step = Math.max(15, rule.slotStepMinutes);
  const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];
  const now = new Date();

  for (let m = startMinutes; m + durationMinutes <= endMinutes; m += step) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const endMTotal = m + durationMinutes;
    const ehh = String(Math.floor(endMTotal / 60)).padStart(2, "0");
    const emm = String(endMTotal % 60).padStart(2, "0");

    const slotStart = new Date(`${dateStr}T${hh}:${mm}:00-03:00`);
    const slotEnd = new Date(`${dateStr}T${ehh}:${emm}:00-03:00`);

    let available = slotStart > now;
    if (available) {
      for (const b of blocks) {
        if (b.startAt < slotEnd && b.endAt > slotStart) {
          available = false;
          break;
        }
      }
    }
    if (available) {
      for (const a of appointments) {
        const extraBuffer = Math.max(0, a.bufferAfterMinutes, rule.bufferMinutes);
        const aEnd = new Date(a.endAt.getTime() + extraBuffer * 60_000);
        if (a.startAt < slotEnd && aEnd > slotStart) {
          available = false;
          break;
        }
      }
    }

    slots.push({
      startTime: `${hh}:${mm}`,
      endTime: `${ehh}:${emm}`,
      available,
    });
  }

  return slots;
}

/**
 * Conclui automaticamente atendimentos já confirmados ou em andamento
 * cujo horário final (endAt) já tenha passado.
 * Agendamentos ainda pendentes de confirmação (REQUESTED/AWAITING_*) não são concluídos.
 */
export async function autoCompleteElapsedAppointments(): Promise<number> {
  const now = new Date();
  const candidates = await prisma.appointment.findMany({
    where: {
      status: { in: ["CONFIRMED", "IN_PROGRESS"] },
      endAt: { lte: now },
    },
    include: {
      client: { select: { userId: true, fullName: true } },
      service: { select: { name: true, sessionsCount: true } },
    },
  });

  if (candidates.length === 0) return 0;

  const completedNow: typeof candidates = [];

  await prisma.$transaction(async (tx) => {
    for (const appt of candidates) {
      const updated = await tx.appointment.updateMany({
        where: {
          id: appt.id,
          status: { in: ["CONFIRMED", "IN_PROGRESS"] },
        },
        data: { status: "COMPLETED" },
      });

      if (updated.count === 1) {
        await tx.appointmentHistory.create({
          data: {
            appointmentId: appt.id,
            changedByUserId: null,
            previousStatus: appt.status,
            newStatus: "COMPLETED",
            previousStartAt: appt.startAt,
            newStartAt: appt.startAt,
            reason: "Concluído automaticamente após o término do horário",
          },
        });
        completedNow.push(appt);
      }
    }
  });

  for (const appt of completedNow) {
    const totalSessions = Math.max(
      appt.totalSessions || 1,
      appt.service?.sessionsCount || 1
    );
    if (appt.sessionNumber < totalSessions) {
      const nextSession = appt.sessionNumber + 1;
      const label = appt.service?.name || appt.title;

      await notifyStudioAdmins({
        eventType: "SESSION_NEXT_PENDING",
        title: `Sessão ${appt.sessionNumber}/${totalSessions} concluída`,
        body: `${appt.client.fullName}: reagendar Sessão ${nextSession}/${totalSessions} de "${label}".`,
        linkUrl: "/admin/agenda",
      });

      if (appt.client.userId) {
        await dispatchNotification({
          recipientUserId: appt.client.userId,
          eventType: "SESSION_NEXT_PENDING",
          title: `Sessão ${appt.sessionNumber}/${totalSessions} concluída`,
          body: `Sua ${appt.sessionNumber}ª sessão de "${label}" foi concluída! Falta agendar a Sessão ${nextSession}/${totalSessions}.`,
          linkUrl: "/minha-conta/agenda",
          channels: ["IN_APP", "EMAIL"],
        });
      }
    }
  }

  return completedNow.length;
}
