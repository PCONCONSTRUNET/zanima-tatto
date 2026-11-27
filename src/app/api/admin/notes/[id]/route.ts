import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";

const patchNoteSchema = z.object({
  title: z.string().trim().min(1).optional(),
  content: z.string().optional(),
  folderId: z.string().nullable().optional(),
  color: z.string().trim().optional(),
  isPinned: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = patchNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const existing = await prisma.studioNote.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Nota não encontrada." },
        { status: 404 }
      );
    }

    const note = await prisma.studioNote.update({
      where: { id },
      data: parsed.data,
      include: {
        folder: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ note });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao atualizar nota." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi();
    const { id } = await context.params;

    await prisma.studioNote.deleteMany({
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
      { error: "Erro ao excluir nota." },
      { status: 500 }
    );
  }
}
