import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formatSequentialCode } from "@/lib/format";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIpAndAgent, getCurrentUser } from "@/lib/security/session";
import { savePrivateFile } from "@/lib/storage/private-storage";
import { notifyStudioAdmins } from "@/lib/notifications";

const quoteSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome completo."),
  whatsapp: z.string().trim().min(8, "Informe seu WhatsApp."),
  email: z.string().trim().email("E-mail inválido.").optional().or(z.literal("")),
  title: z.string().trim().min(2, "Informe um título resumido para a ideia."),
  style: z.string().trim().min(2, "Selecione o estilo."),
  bodyRegion: z.string().trim().min(2, "Informe a região do corpo."),
  approxSizeCm: z.string().trim().min(1, "Informe o tamanho aproximado."),
  ideaDescription: z.string().trim().min(5, "Descreva sua ideia."),
  availabilityText: z.string().trim().optional(),
  clientNotes: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const { ipAddress } = await getClientIpAndAgent();
    const limit = checkRateLimit(`pub-quote:${ipAddress}`, 6, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Aguarde ${limit.retryAfterSeconds}s antes de enviar novamente.` },
        { status: 429 }
      );
    }

    const sessionUser = await getCurrentUser();
    const formData = await request.formData();

    const parsed = quoteSchema.safeParse({
      fullName: String(formData.get("fullName") || ""),
      whatsapp: String(formData.get("whatsapp") || ""),
      email: String(formData.get("email") || ""),
      title: String(formData.get("title") || ""),
      style: String(formData.get("style") || ""),
      bodyRegion: String(formData.get("bodyRegion") || ""),
      approxSizeCm: String(formData.get("approxSizeCm") || ""),
      ideaDescription: String(formData.get("ideaDescription") || ""),
      availabilityText: String(formData.get("availabilityText") || ""),
      clientNotes: String(formData.get("clientNotes") || ""),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Preencha os campos obrigatórios." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const cleanEmail = d.email ? d.email.toLowerCase() : null;
    const digits = d.whatsapp.replace(/\D/g, "");

    let clientId = sessionUser?.clientId ?? null;
    if (!clientId) {
      const existingClient = await prisma.client.findFirst({
        where: {
          isAnonymized: false,
          OR: [
            ...(cleanEmail ? [{ email: cleanEmail }] : []),
            ...(digits.length >= 8
              ? [{ whatsapp: { contains: digits.slice(-8) } }]
              : []),
          ],
        },
      });
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const createdClient = await prisma.client.create({
          data: {
            fullName: d.fullName,
            whatsapp: d.whatsapp,
            phone: d.whatsapp,
            email: cleanEmail,
            preferredStyles: [d.style],
          },
        });
        clientId = createdClient.id;
      }
    }

    const uploadedIds: string[] = [];
    const files = formData.getAll("references");
    for (const entry of files.slice(0, 4)) {
      if (entry instanceof File && entry.size > 0) {
        const stored = await savePrivateFile({
          file: entry,
          uploadedByUserId: sessionUser?.id ?? null,
          clientId,
          visibility: "CLIENT_OWNED",
        });
        uploadedIds.push(stored.id);
      }
    }

    const quote = await prisma.quoteRequest.create({
      data: {
        clientId,
        title: d.title,
        style: d.style,
        bodyRegion: d.bodyRegion,
        approxSizeCm: d.approxSizeCm,
        ideaDescription: d.ideaDescription,
        availabilityText: d.availabilityText || null,
        clientNotes: d.clientNotes || null,
        referenceFileIds: uploadedIds,
        status: "NEW",
      },
    });

    await notifyStudioAdmins({
      eventType: "NEW_QUOTE_REQUEST",
      title: "Nova solicitação de orçamento",
      body: `${d.fullName} solicitou orçamento para "${d.title}" (${d.style}).`,
      linkUrl: "/admin/orcamentos",
    });

    return NextResponse.json(
      {
        quoteId: quote.id,
        quoteCode: formatSequentialCode(quote.codeNumber, quote.id),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/public/quotes]", err);
    return NextResponse.json(
      { error: "Não foi possível enviar sua solicitação de orçamento." },
      { status: 500 }
    );
  }
}
