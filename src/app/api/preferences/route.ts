import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthApi, UnauthorizedError } from "@/lib/security/rbac";

const prefSchema = z.object({
  themePreference: z.enum(["LIGHT", "DARK"]).optional(),
  hideFinancialValues: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthApi();
    const body = await request.json().catch(() => null);
    const parsed = prefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Preferência inválida." }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(parsed.data.themePreference
          ? { themePreference: parsed.data.themePreference }
          : {}),
        ...(typeof parsed.data.hideFinancialValues === "boolean"
          ? { hideFinancialValues: parsed.data.hideFinancialValues }
          : {}),
      },
      select: {
        themePreference: true,
        hideFinancialValues: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro ao salvar preferências." },
      { status: 500 }
    );
  }
}
