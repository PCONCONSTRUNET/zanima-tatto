import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";

const createFolderSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da pasta.").max(50),
  color: z.string().trim().default("champagne"),
});

const patchFolderSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(50).optional(),
  color: z.string().trim().optional(),
});

export async function GET() {
  try {
    const user = await requireAdminApi();
    const folders = await prisma.noteFolder.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ folders });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao listar pastas." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi();
    const body = await request.json().catch(() => null);
    const parsed = createFolderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const folder = await prisma.noteFolder.upsert({
      where: {
        userId_name: {
          userId: user.id,
          name: parsed.data.name,
        },
      },
      update: { color: parsed.data.color },
      create: {
        userId: user.id,
        name: parsed.data.name,
        color: parsed.data.color,
      },
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao salvar pasta." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAdminApi();
    const body = await request.json().catch(() => null);
    const parsed = patchFolderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const existing = await prisma.noteFolder.findFirst({
      where: { id: parsed.data.id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Pasta não encontrada." },
        { status: 404 }
      );
    }

    const folder = await prisma.noteFolder.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
      },
    });

    return NextResponse.json({ folder });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao atualizar pasta." },
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

    await prisma.noteFolder.deleteMany({
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
      { error: "Erro ao excluir pasta." },
      { status: 500 }
    );
  }
}
