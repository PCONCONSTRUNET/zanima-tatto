import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { getAvailableSlotsForDate } from "@/lib/agenda/scheduling";
import { parseSPDateTime } from "@/lib/format";

const rulesSchema = z.object({
  rules: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      slotStepMinutes: z.number().int().min(15).max(120),
      bufferMinutes: z.number().int().min(0).max(120),
      isActive: z.boolean(),
    })
  ),
});

const blockSchema = z.object({
  title: z.string().trim().min(2, "Informe o motivo ou título do bloqueio."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().optional(),
  blockType: z.enum(["MANUAL", "HOLIDAY", "PERSONAL"]).default("MANUAL"),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const duration = Number(searchParams.get("duration") || "60");

    if (date) {
      const slots = await getAvailableSlotsForDate(
        date,
        Number.isFinite(duration) ? duration : 60
      );
      return NextResponse.json({ slots });
    }

    await requireAdminApi("agenda");
    const [rules, blocks] = await Promise.all([
      prisma.availabilityRule.findMany({ orderBy: { dayOfWeek: "asc" } }),
      prisma.availabilityBlock.findMany({ orderBy: { startAt: "asc" }, take: 50 }),
    ]);

    return NextResponse.json({ rules, blocks });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao consultar disponibilidade." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminApi("agenda");
    const body = await request.json().catch(() => null);
    const parsed = rulesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Regras de horário inválidas." },
        { status: 400 }
      );
    }

    await Promise.all(
      parsed.data.rules.map((rule) =>
        prisma.availabilityRule.upsert({
          where: { dayOfWeek: rule.dayOfWeek },
          update: {
            startTime: rule.startTime,
            endTime: rule.endTime,
            slotStepMinutes: rule.slotStepMinutes,
            bufferMinutes: rule.bufferMinutes,
            isActive: rule.isActive,
          },
          create: rule,
        })
      )
    );

    const updated = await prisma.availabilityRule.findMany({
      orderBy: { dayOfWeek: "asc" },
    });
    return NextResponse.json({ rules: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao salvar horários." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi("agenda");
    const body = await request.json().catch(() => null);
    const parsed = blockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados de bloqueio inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const startAt = parseSPDateTime(d.startDate, d.startTime);
    const endAt = parseSPDateTime(d.endDate, d.endTime);

    if (endAt <= startAt) {
      return NextResponse.json(
        { error: "O término do bloqueio deve ser posterior ao início." },
        { status: 400 }
      );
    }

    const block = await prisma.availabilityBlock.create({
      data: {
        title: d.title,
        startAt,
        endAt,
        reason: d.reason || null,
        blockType: d.blockType,
        createdByUserId: user.id,
      },
    });

    return NextResponse.json({ block }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao criar bloqueio." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminApi("agenda");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }
    await prisma.availabilityBlock.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao remover bloqueio." },
      { status: 500 }
    );
  }
}
