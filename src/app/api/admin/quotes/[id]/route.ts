import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { toNumber, parseSPDateTime } from "@/lib/format";
import {
  createAppointmentSafely,
  ScheduleConflictError,
} from "@/lib/agenda/scheduling";
import { dispatchNotification } from "@/lib/notifications";
import { recordAuditLog } from "@/lib/security/audit";

const patchQuoteSchema = z.object({
  quotedAmount: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
  paymentTerms: z.string().trim().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  adminNotes: z.string().trim().optional().nullable(),
  status: z
    .enum(["NEW", "ANALYZING", "SENT", "APPROVED", "DECLINED", "EXPIRED"])
    .optional(),
  sendToClient: z.boolean().optional(),
});

const convertSchema = z.object({
  action: z.literal("convert"),
  plannedSessions: z.number().int().min(1).max(20).default(1),
  scheduleSession: z.boolean().default(false),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  durationMinutes: z.number().int().min(30).max(600).default(120),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi("quotes");
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = patchQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const current = await prisma.quoteRequest.findUnique({
      where: { id },
      include: { client: { select: { userId: true, fullName: true } } },
    });
    if (!current) {
      return NextResponse.json(
        { error: "Orçamento não encontrado." },
        { status: 404 }
      );
    }

    const d = parsed.data;
    const nextStatus = d.sendToClient ? "SENT" : d.status ?? current.status;
    if (nextStatus === "SENT" && (d.quotedAmount ?? toNumber(current.quotedAmount)) <= 0) {
      return NextResponse.json(
        { error: "Informe o valor do orçamento antes de enviar ao cliente." },
        { status: 400 }
      );
    }

    const updated = await prisma.quoteRequest.update({
      where: { id },
      data: {
        ...(d.quotedAmount !== undefined ? { quotedAmount: d.quotedAmount } : {}),
        ...(d.depositAmount !== undefined ? { depositAmount: d.depositAmount } : {}),
        ...(d.paymentTerms !== undefined ? { paymentTerms: d.paymentTerms } : {}),
        ...(d.validUntil !== undefined
          ? {
              validUntil: d.validUntil
                ? new Date(`${d.validUntil.slice(0, 10)}T23:59:59-03:00`)
                : null,
            }
          : {}),
        ...(d.adminNotes !== undefined ? { adminNotes: d.adminNotes } : {}),
        status: nextStatus,
        ...(d.sendToClient ? { respondedAt: new Date() } : {}),
      },
    });

    if (d.sendToClient && current.client.userId) {
      await dispatchNotification({
        recipientUserId: current.client.userId,
        eventType: "QUOTE_SENT",
        title: "Seu orçamento está pronto",
        body: `Leticia enviou a proposta para "${updated.title}". Você já pode revisar e aprovar na Área do Cliente.`,
        linkUrl: "/minha-conta/minhas-tattoos",
        channels: ["IN_APP", "EMAIL"],
      });
    }

    await recordAuditLog({
      actorUserId: user.id,
      action: d.sendToClient ? "QUOTE_SENT" : "QUOTE_UPDATED",
      entityType: "QuoteRequest",
      entityId: id,
    });

    return NextResponse.json({ quote: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao atualizar orçamento." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi("quotes");
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = convertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados de conversão inválidos." },
        { status: 400 }
      );
    }

    const quote = await prisma.quoteRequest.findUnique({
      where: { id },
      include: { client: { select: { id: true, userId: true } } },
    });
    if (!quote) {
      return NextResponse.json(
        { error: "Orçamento não encontrado." },
        { status: 404 }
      );
    }
    if (quote.convertedProjectId) {
      return NextResponse.json(
        { error: "Este orçamento já foi convertido em projeto." },
        { status: 409 }
      );
    }

    const d = parsed.data;
    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.tattooProject.create({
        data: {
          clientId: quote.clientId,
          name: quote.title,
          description: quote.ideaDescription,
          style: quote.style,
          bodyRegion: quote.bodyRegion,
          approxSizeCm: quote.approxSizeCm,
          stage: d.scheduleSession ? "SESSION_SCHEDULED" : "ART_DEVELOPMENT",
          negotiatedAmount: quote.quotedAmount ?? 0,
          depositAmount: quote.depositAmount ?? 0,
          plannedSessions: d.plannedSessions,
        },
      });

      for (const fileId of quote.referenceFileIds) {
        await tx.projectMedia.create({
          data: {
            projectId: createdProject.id,
            fileId,
            kind: "REFERENCE",
            isClientVisible: true,
          },
        });
      }

      await tx.quoteRequest.update({
        where: { id: quote.id },
        data: {
          status: "CONVERTED",
          convertedProjectId: createdProject.id,
        },
      });

      return createdProject;
    });

    let appointment = null;
    if (d.scheduleSession && d.date && d.startTime) {
      appointment = await createAppointmentSafely({
        clientId: quote.clientId,
        artistUserId: user.id,
        projectId: project.id,
        title: `${project.name} — Sessão 1`,
        startAt: parseSPDateTime(d.date, d.startTime),
        durationMinutes: d.durationMinutes,
        bufferAfterMinutes: 15,
        status: toNumber(quote.depositAmount) > 0 ? "AWAITING_DEPOSIT" : "CONFIRMED",
        priceEstimate: toNumber(quote.quotedAmount),
        depositRequired: toNumber(quote.depositAmount),
        changedByUserId: user.id,
      });
    }

    await recordAuditLog({
      actorUserId: user.id,
      action: "QUOTE_CONVERTED",
      entityType: "QuoteRequest",
      entityId: id,
      after: { projectId: project.id, appointmentId: appointment?.id ?? null },
    });

    return NextResponse.json({ project, appointment }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ScheduleConflictError) {
      return NextResponse.json(
        { error: `Projeto criado, mas o horário escolhido conflitou: ${err.message}` },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Erro ao converter orçamento." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi("quotes");
    const { id } = await context.params;

    const existing = await prisma.quoteRequest.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Orçamento não encontrado." },
        { status: 404 }
      );
    }

    await prisma.quoteRequest.delete({ where: { id } });

    await recordAuditLog({
      actorUserId: user.id,
      action: "QUOTE_DELETED",
      entityType: "QuoteRequest",
      entityId: id,
      after: { title: existing.title },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao excluir orçamento." },
      { status: 500 }
    );
  }
}
