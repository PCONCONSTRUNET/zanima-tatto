import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthApi, UnauthorizedError } from "@/lib/security/rbac";
import { notifyStudioAdmins } from "@/lib/notifications";

const decisionSchema = z.object({
  quoteId: z.string().min(1),
  decision: z.enum(["APPROVED", "DECLINED"]),
  reason: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user.clientId) {
      return NextResponse.json(
        { error: "Perfil de cliente não vinculado." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const quote = await prisma.quoteRequest.findUnique({
      where: { id: parsed.data.quoteId },
    });
    if (!quote || quote.clientId !== user.clientId) {
      return NextResponse.json(
        { error: "Orçamento não encontrado." },
        { status: 404 }
      );
    }

    if (quote.status !== "SENT") {
      return NextResponse.json(
        { error: "Este orçamento não está aguardando sua resposta." },
        { status: 400 }
      );
    }

    const updated = await prisma.quoteRequest.update({
      where: { id: quote.id },
      data: {
        status: parsed.data.decision,
        clientDecisionAt: new Date(),
        clientDecisionReason: parsed.data.reason || null,
      },
    });

    await notifyStudioAdmins({
      eventType:
        parsed.data.decision === "APPROVED"
          ? "QUOTE_APPROVED"
          : "QUOTE_DECLINED",
      title:
        parsed.data.decision === "APPROVED"
          ? "Orçamento aprovado pelo cliente"
          : "Orçamento recusado pelo cliente",
      body: `${user.name} ${
        parsed.data.decision === "APPROVED" ? "aprovou" : "recusou"
      } a proposta "${quote.title}".`,
      linkUrl: "/admin/orcamentos",
    });

    return NextResponse.json({ quote: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro ao registrar resposta." },
      { status: 500 }
    );
  }
}
