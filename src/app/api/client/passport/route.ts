import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthApi, UnauthorizedError } from "@/lib/security/rbac";

const updatePassportSchema = z.object({
  passportId: z.string().min(1),
  clientMeaning: z.string().trim().max(1500),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user.clientId) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = updatePassportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const updated = await prisma.tattooPassport.updateMany({
      where: { id: parsed.data.passportId, clientId: user.clientId },
      data: { clientMeaning: parsed.data.clientMeaning },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Registro do passaporte não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro ao atualizar significado." },
      { status: 500 }
    );
  }
}
