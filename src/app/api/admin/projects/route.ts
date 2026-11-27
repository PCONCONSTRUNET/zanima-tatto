import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";
import { recordAuditLog } from "@/lib/security/audit";

const createProjectSchema = z.object({
  clientId: z.string().min(1, "Selecione o cliente."),
  name: z.string().trim().min(2, "Informe o nome do projeto."),
  description: z.string().trim().min(3, "Descreva a tatuagem."),
  style: z.string().trim().min(2, "Informe o estilo artístico."),
  bodyRegion: z.string().trim().min(2, "Informe a região do corpo."),
  approxSizeCm: z.string().trim().min(1, "Informe o tamanho aproximado."),
  negotiatedAmount: z.number().min(0).default(0),
  depositAmount: z.number().min(0).default(0),
  plannedSessions: z.number().int().min(1).max(30).default(1),
  aftercareGuidance: z.string().trim().optional(),
  stage: z
    .enum([
      "INITIAL_IDEA",
      "QUOTING",
      "AWAITING_APPROVAL",
      "ART_DEVELOPMENT",
      "ART_APPROVED",
      "SESSION_SCHEDULED",
      "IN_EXECUTION",
      "HEALING",
      "COMPLETED",
    ])
    .default("ART_DEVELOPMENT"),
});

export async function GET(request: Request) {
  try {
    await requireAdminApi("projects");
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage");

    const projects = await prisma.tattooProject.findMany({
      where: stage && stage !== "ALL" ? { stage: stage as never } : undefined,
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { id: true, fullName: true, whatsapp: true } },
        appointments: {
          select: { id: true, startAt: true, status: true, sessionNumber: true },
          orderBy: { startAt: "asc" },
        },
        payments: {
          where: { status: "CONFIRMED" },
          select: { amount: true },
        },
        media: {
          take: 4,
          include: { file: { select: { id: true, mimeType: true } } },
        },
        passport: { select: { id: true } },
      },
    });

    const enriched = projects.map((p) => {
      const paidTotal = p.payments.reduce((acc, pay) => acc + toNumber(pay.amount), 0);
      const negotiated = toNumber(p.negotiatedAmount);
      return {
        ...p,
        paidTotal,
        remainingBalance: Math.max(0, negotiated - paidTotal),
      };
    });

    return NextResponse.json({ projects: enriched });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao listar projetos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi("projects");
    const body = await request.json().catch(() => null);
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const project = await prisma.tattooProject.create({
      data: {
        clientId: d.clientId,
        name: d.name,
        description: d.description,
        style: d.style,
        bodyRegion: d.bodyRegion,
        approxSizeCm: d.approxSizeCm,
        negotiatedAmount: d.negotiatedAmount,
        depositAmount: d.depositAmount,
        plannedSessions: d.plannedSessions,
        aftercareGuidance: d.aftercareGuidance || null,
        stage: d.stage,
      },
    });

    await recordAuditLog({
      actorUserId: user.id,
      action: "PROJECT_CREATED",
      entityType: "TattooProject",
      entityId: project.id,
      after: { name: project.name, clientId: project.clientId },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao criar projeto." },
      { status: 500 }
    );
  }
}
