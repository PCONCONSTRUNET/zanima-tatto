import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";

const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da categoria."),
});

export async function GET() {
  try {
    await requireAdminApi("agenda");
    const categories = await prisma.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ categories });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao listar categorias." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminApi("agenda");
    const body = await request.json().catch(() => null);
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Nome inválido." },
        { status: 400 }
      );
    }

    const existing = await prisma.serviceCategory.findFirst({
      where: { name: { equals: parsed.data.name, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Essa categoria já existe." },
        { status: 409 }
      );
    }

    const category = await prisma.serviceCategory.create({
      data: { name: parsed.data.name },
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao criar categoria." },
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
      return NextResponse.json(
        { error: "Informe a categoria." },
        { status: 400 }
      );
    }
    await prisma.serviceCategory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao excluir categoria." },
      { status: 500 }
    );
  }
}
