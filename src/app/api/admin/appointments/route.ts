import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import {
  autoCompleteElapsedAppointments,
  createAppointmentSafely,
  ScheduleConflictError,
} from "@/lib/agenda/scheduling";
import { parseSPDateTime } from "@/lib/format";
import { recordAuditLog } from "@/lib/security/audit";
import { dispatchNotification } from "@/lib/notifications";

const createSchema = z.object({
  clientId: z.string().min(1, "Selecione o cliente."),
  projectId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  title: z.string().trim().min(2, "Informe o título do atendimento."),
  description: z.string().trim().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido."),
  durationMinutes: z.number().int().min(15).max(720),
  bufferAfterMinutes: z.number().int().min(0).max(180).default(0),
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
    .default("CONFIRMED"),
  sessionNumber: z.number().int().min(1).default(1),
  totalSessions: z.number().int().min(1).max(24).optional(),
  priceEstimate: z.number().min(0).optional().nullable(),
  depositRequired: z.number().min(0).optional().nullable(),
  clientNotes: z.string().trim().optional(),
  internalNotes: z.string().trim().optional(),
  recurrenceCount: z.number().int().min(1).max(12).default(1),
  recurrenceIntervalDays: z.number().int().min(1).max(90).default(30),
});

export async function GET(request: Request) {
  try {
    await requireAdminApi("agenda");
    await autoCompleteElapsedAppointments();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (from && to) {
      where.startAt = {
        gte: new Date(`${from}T00:00:00-03:00`),
        lte: new Date(`${to}T23:59:59-03:00`),
      };
    }
    if (status && status !== "ALL") {
      where.status = status;
    }

    const [appointments, blocks, rules] = await Promise.all([
      prisma.appointment.findMany({
        where,
        orderBy: { startAt: "asc" },
        include: {
          client: {
            select: {
              id: true,
              fullName: true,
              whatsapp: true,
              phone: true,
            },
          },
          project: {
            select: { id: true, name: true, style: true, stage: true },
          },
          service: {
            select: { id: true, name: true, category: true, sessionsCount: true },
          },
          payments: {
            select: { id: true, amount: true, status: true, kind: true },
          },
          history: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      }),
      from && to
        ? prisma.availabilityBlock.findMany({
            where: {
              startAt: { lte: new Date(`${to}T23:59:59-03:00`) },
              endAt: { gte: new Date(`${from}T00:00:00-03:00`) },
            },
            orderBy: { startAt: "asc" },
          })
        : prisma.availabilityBlock.findMany({
            orderBy: { startAt: "desc" },
            take: 30,
          }),
      prisma.availabilityRule.findMany({ orderBy: { dayOfWeek: "asc" } }),
    ]);

    return NextResponse.json({ appointments, blocks, rules });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao carregar agenda." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi("agenda");
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const baseStart = parseSPDateTime(d.date, d.startTime);
    if (Number.isNaN(baseStart.getTime())) {
      return NextResponse.json({ error: "Data ou hora inválida." }, { status: 400 });
    }

    let resolvedTotalSessions = d.totalSessions ?? d.recurrenceCount;
    if (d.serviceId && d.totalSessions === undefined) {
      const svc = await prisma.studioService.findUnique({
        where: { id: d.serviceId },
        select: { sessionsCount: true },
      });
      if (svc && svc.sessionsCount > resolvedTotalSessions) {
        resolvedTotalSessions = svc.sessionsCount;
      }
    }

    const recurrenceGroupId =
      d.recurrenceCount > 1 ? crypto.randomUUID() : null;
    const createdList = [];

    for (let i = 0; i < d.recurrenceCount; i++) {
      const startAt = new Date(
        baseStart.getTime() + i * d.recurrenceIntervalDays * 24 * 60 * 60 * 1000
      );
      const appt = await createAppointmentSafely({
        clientId: d.clientId,
        artistUserId: user.id,
        projectId: d.projectId || null,
        serviceId: d.serviceId || null,
        title:
          d.recurrenceCount > 1
            ? `${d.title} (Sessão ${d.sessionNumber + i})`
            : d.title,
        description: d.description || null,
        startAt,
        durationMinutes: d.durationMinutes,
        bufferAfterMinutes: d.bufferAfterMinutes,
        status: d.status,
        sessionNumber: d.sessionNumber + i,
        totalSessions: Math.max(resolvedTotalSessions, d.sessionNumber + i),
        recurrenceGroupId,
        priceEstimate: d.priceEstimate ?? null,
        depositRequired: d.depositRequired ?? null,
        clientNotes: d.clientNotes || null,
        internalNotes: d.internalNotes || null,
        changedByUserId: user.id,
      });
      createdList.push(appt);
    }

    const client = await prisma.client.findUnique({
      where: { id: d.clientId },
      select: { userId: true, fullName: true },
    });

    if (client?.userId) {
      await dispatchNotification({
        recipientUserId: client.userId,
        eventType: "APPOINTMENT_CREATED",
        title: "Novo agendamento no ZANIMA TATTOO",
        body: `Seu atendimento "${d.title}" foi registrado para ${d.date.split("-").reverse().join("/")} às ${d.startTime}.`,
        linkUrl: "/minha-conta/agenda",
        channels: ["IN_APP", "EMAIL"],
      });
    }

    await recordAuditLog({
      actorUserId: user.id,
      action: "APPOINTMENT_CREATED",
      entityType: "Appointment",
      entityId: createdList[0].id,
      after: { count: createdList.length, title: d.title },
    });

    return NextResponse.json(
      { appointment: createdList[0], appointments: createdList },
      { status: 201 }
    );
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
    console.error("[POST /api/admin/appointments]", err);
    return NextResponse.json(
      { error: "Erro ao criar agendamento." },
      { status: 500 }
    );
  }
}
