import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthApi, UnauthorizedError } from "@/lib/security/rbac";
import { notifyStudioAdmins } from "@/lib/notifications";

const ideaSchema = z.object({
  title: z.string().trim().min(2, "Informe um título para a ideia."),
  description: z.string().trim().min(3, "Descreva sua ideia."),
  style: z.string().trim().min(2),
  bodyRegion: z.string().trim().optional(),
  approxSizeCm: z.string().trim().optional(),
  referenceFileIds: z.array(z.string()).optional().default([]),
});

const convertIdeaSchema = z.object({
  action: z.literal("request_quote"),
  ideaId: z.string().min(1),
  availabilityText: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user.clientId) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);

    if (body?.action === "request_quote") {
      const parsed = convertIdeaSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
      }
      const idea = await prisma.futureTattooIdea.findUnique({
        where: { id: parsed.data.ideaId },
      });
      if (!idea || idea.clientId !== user.clientId) {
        return NextResponse.json({ error: "Ideia não encontrada." }, { status: 404 });
      }
      if (idea.convertedQuoteId) {
        return NextResponse.json(
          { error: "Um orçamento já foi solicitado a partir desta ideia." },
          { status: 409 }
        );
      }

      const quote = await prisma.$transaction(async (tx) => {
        const created = await tx.quoteRequest.create({
          data: {
            clientId: user.clientId!,
            title: idea.title,
            ideaDescription: idea.description,
            style: idea.style,
            bodyRegion: idea.bodyRegion || "A definir",
            approxSizeCm: idea.approxSizeCm || "A definir",
            availabilityText: parsed.data.availabilityText || null,
            referenceFileIds: idea.referenceFileIds,
            status: "NEW",
          },
        });
        await tx.futureTattooIdea.update({
          where: { id: idea.id },
          data: { convertedQuoteId: created.id },
        });
        return created;
      });

      await notifyStudioAdmins({
        eventType: "NEW_QUOTE_FROM_IDEA",
        title: "Orçamento de Minha Próxima Tattoo",
        body: `${user.name} solicitou orçamento para a ideia "${idea.title}".`,
        linkUrl: "/admin/orcamentos",
      });

      return NextResponse.json({ quote }, { status: 201 });
    }

    const parsed = ideaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const idea = await prisma.futureTattooIdea.create({
      data: {
        clientId: user.clientId,
        title: d.title,
        description: d.description,
        style: d.style,
        bodyRegion: d.bodyRegion || null,
        approxSizeCm: d.approxSizeCm || null,
        referenceFileIds: d.referenceFileIds,
      },
    });

    return NextResponse.json({ idea }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro ao salvar ideia." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user.clientId) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }
    await prisma.futureTattooIdea.deleteMany({
      where: { id, clientId: user.clientId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.json({ error: "Erro ao excluir." }, { status: 500 });
  }
}
