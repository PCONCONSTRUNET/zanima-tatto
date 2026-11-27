import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import {
  assertNoScheduleConflict,
  ScheduleConflictError,
} from "@/lib/agenda/scheduling";
import { parseSPDateTime } from "@/lib/format";
import { recordAuditLog } from "@/lib/security/audit";
import { dispatchNotification, notifyStudioAdmins } from "@/lib/notifications";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/domain-labels";

const patchSchema = z.object({
  status: z
    .enum([
      "REQUESTED",
      "AWAITING_CONFIRMATION",
      "AWAITING_DEPOSIT",
      "CONFIRMED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ])
    .optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  durationMinutes: z.number().int().min(15).max(720).optional(),
  bufferAfterMinutes: z.number().int().min(0).max(180).optional(),
  internalNotes: z.string().optional().nullable(),
  clientNotes: z.string().optional().nullable(),
  priceEstimate: z.number().min(0).optional().nullable(),
  depositRequired: z.number().min(0).optional().nullable(),
  reason: z.string().trim().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi("agenda");
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const updated = await prisma.$transaction(
      async (tx) => {
        const current = await tx.appointment.findUnique({
          where: { id },
          include: {
            client: { select: { userId: true, fullName: true } },
            service: { select: { name: true } },
          },
        });
        if (!current) {
          throw new Error("NOT_FOUND");
        }

        const nextDuration = d.durationMinutes ?? current.durationMinutes;
        const nextBuffer = d.bufferAfterMinutes ?? current.bufferAfterMinutes;
        let nextStartAt = current.startAt;

        if (d.date && d.startTime) {
          nextStartAt = parseSPDateTime(d.date, d.startTime);
        }
        const nextEndAt = new Date(
          nextStartAt.getTime() + nextDuration * 60_000
        );
        const nextStatus = d.status ?? current.status;

        if (nextStatus !== "CANCELLED" && nextStatus !== "NO_SHOW") {
          await assertNoScheduleConflict(tx, {
            startAt: nextStartAt,
            endAt: nextEndAt,
            bufferAfterMinutes: nextBuffer,
            excludeAppointmentId: id,
          });
        }

        const saved = await tx.appointment.update({
          where: { id },
          data: {
            status: nextStatus,
            startAt: nextStartAt,
            endAt: nextEndAt,
            durationMinutes: nextDuration,
            bufferAfterMinutes: nextBuffer,
            internalNotes:
              d.internalNotes !== undefined
                ? d.internalNotes
                : current.internalNotes,
            clientNotes:
              d.clientNotes !== undefined ? d.clientNotes : current.clientNotes,
            priceEstimate:
              d.priceEstimate !== undefined
                ? d.priceEstimate
                : current.priceEstimate,
            depositRequired:
              d.depositRequired !== undefined
                ? d.depositRequired
                : current.depositRequired,
            confirmedAt:
              nextStatus === "CONFIRMED" && !current.confirmedAt
                ? new Date()
                : current.confirmedAt,
          },
        });

        await tx.appointmentHistory.create({
          data: {
            appointmentId: id,
            changedByUserId: user.id,
            previousStatus: current.status,
            newStatus: nextStatus,
            previousStartAt: current.startAt,
            newStartAt: nextStartAt,
            reason:
              d.reason ||
              (current.status !== nextStatus
                ? `Status alterado para ${APPOINTMENT_STATUS_LABELS[nextStatus]}`
                : "Atendimento atualizado"),
          },
        });

        return {
          saved,
          clientUserId: current.client.userId,
          clientName: current.client.fullName,
          serviceName: current.service?.name || null,
          prevStatus: current.status,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const isCompletedMultiSessionTransition =
      updated.prevStatus !== "COMPLETED" &&
      updated.saved.status === "COMPLETED" &&
      updated.saved.sessionNumber < updated.saved.totalSessions;

    if (isCompletedMultiSessionTransition) {
      const nextSession = updated.saved.sessionNumber + 1;
      const totalSessions = updated.saved.totalSessions;
      const label = updated.serviceName || updated.saved.title;

      await notifyStudioAdmins({
        eventType: "SESSION_NEXT_PENDING",
        title: `Sessão ${updated.saved.sessionNumber}/${totalSessions} concluída`,
        body: `${updated.clientName}: reagendar Sessão ${nextSession}/${totalSessions} de "${label}".`,
        linkUrl: "/admin/agenda",
      });

      if (updated.clientUserId) {
        await dispatchNotification({
          recipientUserId: updated.clientUserId,
          eventType: "SESSION_NEXT_PENDING",
          title: `Sessão ${updated.saved.sessionNumber}/${totalSessions} concluída`,
          body: `Sua ${updated.saved.sessionNumber}ª sessão de "${label}" foi concluída! Falta agendar a Sessão ${nextSession}/${totalSessions}.`,
          linkUrl: "/minha-conta/agenda",
          channels: ["IN_APP", "EMAIL"],
        });
      }
    } else if (
      updated.clientUserId &&
      (updated.prevStatus !== updated.saved.status ||
        d.date ||
        d.durationMinutes !== undefined)
    ) {
      await dispatchNotification({
        recipientUserId: updated.clientUserId,
        eventType: "APPOINTMENT_UPDATED",
        title: "Atualização no seu agendamento",
        body: `O atendimento "${updated.saved.title}" está com status: ${APPOINTMENT_STATUS_LABELS[updated.saved.status]}.`,
        linkUrl: "/minha-conta/agenda",
        channels: ["IN_APP", "EMAIL"],
      });
    }

    await recordAuditLog({
      actorUserId: user.id,
      action: "APPOINTMENT_UPDATED",
      entityType: "Appointment",
      entityId: id,
      after: { status: updated.saved.status, startAt: updated.saved.startAt },
    });

    return NextResponse.json({ appointment: updated.saved });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ScheduleConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Agendamento não encontrado." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Erro ao atualizar agendamento." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi("agenda");
    const { id } = await context.params;

    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.appointment.findUnique({
        where: { id },
        select: { id: true, title: true, startAt: true },
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      await tx.appointmentHistory.deleteMany({ where: { appointmentId: id } });
      await tx.payment.deleteMany({
        where: { appointmentId: id, status: "PENDING" },
      });
      await tx.payment.updateMany({
        where: { appointmentId: id },
        data: { appointmentId: null },
      });
      await tx.financialTransaction.updateMany({
        where: { appointmentId: id },
        data: { appointmentId: null },
      });
      await tx.stockMovement.updateMany({
        where: { appointmentId: id },
        data: { appointmentId: null },
      });
      await tx.documentSignature.updateMany({
        where: { appointmentId: id },
        data: { appointmentId: null },
      });

      await tx.appointment.delete({ where: { id } });
      return existing;
    });

    await recordAuditLog({
      actorUserId: user.id,
      action: "APPOINTMENT_DELETED",
      entityType: "Appointment",
      entityId: id,
      before: { title: deleted.title, startAt: deleted.startAt },
    });

    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Agendamento não encontrado." },
        { status: 404 }
      );
    }
    console.error("[DELETE /api/admin/appointments/[id]]", err);
    return NextResponse.json(
      { error: "Erro ao excluir agendamento." },
      { status: 500 }
    );
  }
}
