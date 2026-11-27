import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { generateQuotePdf } from "@/lib/pdf";
import { formatSequentialCode, toNumber } from "@/lib/format";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApi("quotes");
    const { id } = await context.params;
    const quote = await prisma.quoteRequest.findUnique({
      where: { id },
      include: {
        client: { select: { fullName: true, whatsapp: true, email: true } },
      },
    });
    if (!quote) {
      return NextResponse.json(
        { error: "Orçamento não encontrado." },
        { status: 404 }
      );
    }

    const quoteCode = formatSequentialCode(quote.codeNumber, quote.id);
    const pdf = await generateQuotePdf({
      id: quote.id,
      code: quoteCode,
      clientName: quote.client.fullName,
      clientContact: quote.client.whatsapp || quote.client.email || "—",
      title: quote.title,
      style: quote.style,
      bodyRegion: quote.bodyRegion,
      approxSizeCm: quote.approxSizeCm,
      ideaDescription: quote.ideaDescription,
      quotedAmount: toNumber(quote.quotedAmount),
      depositAmount: toNumber(quote.depositAmount),
      paymentTerms: quote.paymentTerms || "A combinar",
      validUntil: quote.validUntil,
      adminNotes: quote.adminNotes,
      createdAt: quote.createdAt,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="orcamento-zanima-${quoteCode}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao gerar PDF." }, { status: 500 });
  }
}
