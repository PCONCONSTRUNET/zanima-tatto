import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";

const createNoteSchema = z.object({
  title: z.string().trim().min(1, "Informe o título da nota."),
  content: z.string().default(""),
  folderId: z.string().nullable().optional(),
  color: z.string().trim().default("default"),
  isPinned: z.boolean().default(false),
});

export async function GET() {
  try {
    const user = await requireAdminApi();
    const notes = await prisma.studioNote.findMany({
      where: { userId: user.id },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      include: {
        folder: { select: { id: true, name: true, color: true } },
      },
    });
    return NextResponse.json({ notes });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao listar notas." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi();
    const body = await request.json().catch(() => null);
    const parsed = createNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const note = await prisma.studioNote.create({
      data: {
        userId: user.id,
        folderId: d.folderId || null,
        title: d.title,
        content: d.content,
        color: d.color,
        isPinned: d.isPinned,
      },
      include: {
        folder: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao criar nota." },
      { status: 500 }
    );
  }
}
