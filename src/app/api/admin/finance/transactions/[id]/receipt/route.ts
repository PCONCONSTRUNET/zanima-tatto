import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertFinancialContextAccess,
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";
import {
  PAYMENT_METHOD_LABELS,
  TRANSACTION_STATUS_LABELS,
} from "@/lib/domain-labels";
import { generatePaymentReceiptPdf } from "@/lib/pdf";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi();
    const { id } = await context.params;
    const tx = await prisma.financialTransaction.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } },
        account: { select: { name: true } },
        creditCard: { select: { name: true } },
        appointment: {
          select: { client: { select: { fullName: true } } },
        },
        project: {
          select: { client: { select: { fullName: true } } },
        },
        payment: {
          select: { client: { select: { fullName: true } } },
        },
      },
    });
    if (!tx) {
      return NextResponse.json(
        { error: "Lançamento não encontrado." },
        { status: 404 }
      );
    }

    assertFinancialContextAccess(user, tx.context);

    const payerName =
      tx.appointment?.client.fullName ||
      tx.project?.client.fullName ||
      tx.payment?.client.fullName ||
      (tx.context === "PERSONAL" ? "Pessoal" : "Estúdio ZANIMA TATTOO");

    const pdf = await generatePaymentReceiptPdf({
      receiptCode: tx.id.slice(-8).toUpperCase(),
      title: tx.description,
      payerName,
      amount: toNumber(tx.amount),
      paymentMethodLabel:
        PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod,
      statusLabel: TRANSACTION_STATUS_LABELS[tx.status] || tx.status,
      paidAt: tx.paidAt || tx.competenceDate,
      categoryOrKind: `${tx.type === "INCOME" ? "Entrada" : "Saída"} • ${tx.category?.name || "Geral"}`,
      notes: tx.notes,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="comprovante-pagamento-${tx.id.slice(-6)}.pdf"`,
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
