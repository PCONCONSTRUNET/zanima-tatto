import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";

const createSchema = z.object({
  title: z.string().trim().min(1, "Informe o título do lembrete."),
  description: z.string().trim().optional(),
  dueAt: z.string().min(1, "Informe a data do lembrete."),
  color: z.string().trim().optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  completed: z.boolean().optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  dueAt: z.string().optional(),
  color: z.string().trim().optional(),
});

function parseDueAtInput(raw: string): Date {
  if (raw.length === 10) {
    return new Date(`${raw}T09:00:00-03:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return new Date(`${raw}:00-03:00`);
  }
  return new Date(raw);
}

export async function GET() {
  try {
    const user = await requireAdminApi();
    const reminders = await prisma.reminder.findMany({
      where: { userId: user.id },
      orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }],
      take: 100,
    });
    return NextResponse.json({ reminders });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao listar lembretes." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi();
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const dueAt = parseDueAtInput(parsed.data.dueAt);
    if (Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    }

    const reminder = await prisma.reminder.create({
      data: {
        userId: user.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        color: parsed.data.color || "default",
        dueAt,
      },
    });

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao criar lembrete." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAdminApi();
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const d = parsed.data;
    const data: Record<string, unknown> = {};
    if (d.completed !== undefined) {
      data.completedAt = d.completed ? new Date() : null;
    }
    if (d.title !== undefined) data.title = d.title;
    if (d.description !== undefined) data.description = d.description;
    if (d.color !== undefined) data.color = d.color;
    if (d.dueAt !== undefined) {
      const parsedDate = parseDueAtInput(d.dueAt);
      if (!Number.isNaN(parsedDate.getTime())) {
        data.dueAt = parsedDate;
      }
    }

    const existing = await prisma.reminder.findFirst({
      where: { id: d.id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Lembrete não encontrado." },
        { status: 404 }
      );
    }

    const reminder = await prisma.reminder.update({
      where: { id: d.id },
      data,
    });

    return NextResponse.json({ ok: true, reminder });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao atualizar lembrete." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAdminApi();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }
    await prisma.reminder.deleteMany({
      where: { id, userId: user.id },
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
      { error: "Erro ao excluir lembrete." },
      { status: 500 }
    );
  }
}
