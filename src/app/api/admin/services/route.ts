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

const serviceSchema = z.object({
  category: z.string().trim().optional().default(""),
  name: z.string().trim().min(2, "Informe o nome do serviço."),
  description: z.string().trim().optional().nullable(),
  durationMinutes: z.number().int().min(15).max(720).optional().default(120),
  sessionsCount: z.number().int().min(1).max(24).optional().default(1),
  price: z.number().min(0).optional().default(0),
  depositAmount: z.number().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export async function GET() {
  try {
    await requireAdminApi("agenda");
    const services = await prisma.studioService.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({
      services: services.map((s) => ({
        ...s,
        price: toNumber(s.price),
        depositAmount: toNumber(s.depositAmount),
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao listar serviços." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi("agenda");
    const body = await request.json().catch(() => null);
    const parsed = serviceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const service = await prisma.studioService.create({
      data: {
        category: d.category || "",
        name: d.name,
        description: d.description || null,
        durationMinutes: d.durationMinutes,
        sessionsCount: d.sessionsCount,
        price: d.price,
        depositAmount: d.depositAmount,
        isActive: d.isActive,
      },
    });

    await recordAuditLog({
      actorUserId: user.id,
      action: "SERVICE_CREATED",
      entityType: "StudioService",
      entityId: service.id,
      after: {
        category: d.category,
        name: d.name,
        price: d.price,
        sessionsCount: d.sessionsCount,
      },
    });

    return NextResponse.json(
      {
        service: {
          ...service,
          price: toNumber(service.price),
          depositAmount: toNumber(service.depositAmount),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao cadastrar serviço." },
      { status: 500 }
    );
  }
}
