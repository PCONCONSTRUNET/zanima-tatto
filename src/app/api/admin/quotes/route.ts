import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { recordAuditLog } from "@/lib/security/audit";

const createQuoteSchema = z.object({
  clientId: z.string().min(1, "Selecione o cliente."),
  title: z.string().trim().min(2, "Informe o título do orçamento."),
  ideaDescription: z.string().trim().min(3, "Descreva a ideia."),
  style: z.string().trim().min(2),
  bodyRegion: z.string().trim().min(2),
  approxSizeCm: z.string().trim().min(1),
  availabilityText: z.string().trim().optional(),
  clientNotes: z.string().trim().optional(),
  quotedAmount: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
  paymentTerms: z.string().trim().optional(),
  validUntil: z.string().optional(),
  adminNotes: z.string().trim().optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdminApi("quotes");
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const quotes = await prisma.quoteRequest.findMany({
      where: status && status !== "ALL" ? { status: status as never } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: { id: true, fullName: true, whatsapp: true, email: true },
        },
        convertedProject: { select: { id: true, name: true, stage: true } },
      },
    });

    return NextResponse.json({ quotes });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao listar orçamentos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi("quotes");
    const body = await request.json().catch(() => null);
    const parsed = createQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const validUntil = d.validUntil
      ? new Date(`${d.validUntil.slice(0, 10)}T23:59:59-03:00`)
      : null;

    const quote = await prisma.quoteRequest.create({
      data: {
        clientId: d.clientId,
        title: d.title,
        ideaDescription: d.ideaDescription,
        style: d.style,
        bodyRegion: d.bodyRegion,
        approxSizeCm: d.approxSizeCm,
        availabilityText: d.availabilityText || null,
        clientNotes: d.clientNotes || null,
        quotedAmount: d.quotedAmount ?? null,
        depositAmount: d.depositAmount ?? null,
        paymentTerms: d.paymentTerms || null,
        validUntil,
        adminNotes: d.adminNotes || null,
        status: d.quotedAmount ? "ANALYZING" : "NEW",
      },
    });

    await recordAuditLog({
      actorUserId: user.id,
      action: "QUOTE_CREATED_ADMIN",
      entityType: "QuoteRequest",
      entityId: quote.id,
    });

    return NextResponse.json({ quote }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao criar orçamento." },
      { status: 500 }
    );
  }
}
