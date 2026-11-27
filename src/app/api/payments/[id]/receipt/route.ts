import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAuthApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { formatSequentialCode, toNumber } from "@/lib/format";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/domain-labels";
import { generatePaymentReceiptPdf } from "@/lib/pdf";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthApi();
    const { id } = await context.params;
    const pay = await prisma.payment.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, fullName: true } },
        project: { select: { name: true } },
        appointment: { select: { title: true } },
      },
    });
    if (!pay) {
      return NextResponse.json(
        { error: "Pagamento não encontrado." },
        { status: 404 }
      );
    }

    const isAdmin = user.role === "OWNER" || user.role === "STAFF";
    if (!isAdmin && user.clientId !== pay.clientId) {
      throw new ForbiddenError("Você não tem acesso a este comprovante.");
    }

    const kindLabel =
      pay.kind === "DEPOSIT"
        ? "Sinal de reserva"
        : pay.kind === "PARTIAL"
          ? "Pagamento parcial"
          : "Pagamento integral";

    const receiptCode = formatSequentialCode(pay.codeNumber, pay.id);
    const pdf = await generatePaymentReceiptPdf({
      receiptCode,
      title:
        pay.project?.name ||
        pay.appointment?.title ||
        "Pagamento ao estúdio ZANIMA TATTOO",
      payerName: pay.client.fullName,
      amount: toNumber(pay.amount),
      paymentMethodLabel: PAYMENT_METHOD_LABELS[pay.method] || pay.method,
      statusLabel: PAYMENT_STATUS_LABELS[pay.status] || pay.status,
      paidAt: pay.confirmedAt || pay.createdAt,
      categoryOrKind: kindLabel,
      notes: pay.notes,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="comprovante-pagamento-${receiptCode}.pdf"`,
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
    return NextResponse.json(
      { error: "Erro ao gerar comprovante." },
      { status: 500 }
    );
  }
}
