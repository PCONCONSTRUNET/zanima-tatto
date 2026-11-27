import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertFinancialContextAccess,
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { formatBRL, formatDateBR, toNumber } from "@/lib/format";
import { TRANSACTION_STATUS_LABELS } from "@/lib/domain-labels";
import { generateFinanceReportPdf } from "@/lib/pdf";

export async function GET(request: Request) {
  try {
    const user = await requireAdminApi("studioFinance");
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get("context") || "STUDIO") as
      | "ALL"
      | "STUDIO"
      | "PERSONAL";
    const format = searchParams.get("format") || "csv";
    const month = searchParams.get("month"); // YYYY-MM
    const from = searchParams.get("from"); // YYYY-MM-DD
    const to = searchParams.get("to"); // YYYY-MM-DD

    assertFinancialContextAccess(user, scope);

    const where: Record<string, unknown> = {};
    if (scope === "STUDIO" || scope === "PERSONAL") {
      where.context = scope;
    }
    if (scope === "PERSONAL" || scope === "ALL") {
      where.ownerUserId = user.id;
    }

    if (
      from &&
      to &&
      /^\d{4}-\d{2}-\d{2}$/.test(from) &&
      /^\d{4}-\d{2}-\d{2}$/.test(to)
    ) {
      const [fy, fm, fd] = from.split("-").map(Number);
      const [ty, tm, td] = to.split("-").map(Number);
      where.competenceDate = {
        gte: new Date(Date.UTC(fy, fm - 1, fd)),
        lte: new Date(Date.UTC(ty, tm - 1, td, 23, 59, 59)),
      };
    } else if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 1));
      where.competenceDate = { gte: start, lt: end };
    }

    const txs = await prisma.financialTransaction.findMany({
      where,
      orderBy: { competenceDate: "desc" },
      include: {
        category: { select: { name: true } },
        account: { select: { name: true } },
      },
    });

    if (format === "pdf") {
      const settledIncome = txs
        .filter((t) => t.type === "INCOME" && t.status === "RECEIVED")
        .reduce((acc, t) => acc + toNumber(t.amount), 0);
      const settledExpense = txs
        .filter((t) => t.type === "EXPENSE" && t.status === "PAID")
        .reduce((acc, t) => acc + toNumber(t.amount), 0);
      const pendingReceive = txs
        .filter(
          (t) =>
            t.type === "INCOME" &&
            (t.status === "PENDING" || t.status === "OVERDUE")
        )
        .reduce((acc, t) => acc + toNumber(t.amount), 0);
      const pendingPay = txs
        .filter(
          (t) =>
            t.type === "EXPENSE" &&
            (t.status === "PENDING" || t.status === "OVERDUE")
        )
        .reduce((acc, t) => acc + toNumber(t.amount), 0);

      const scopeLabel =
        scope === "ALL"
          ? "Visão Geral (Estúdio + Pessoal)"
          : scope === "STUDIO"
          ? "Estúdio ZANIMA TATTOO"
          : "Finanças Pessoais";

      const pdf = await generateFinanceReportPdf({
        scopeLabel,
        periodLabel: month || "Todo o histórico",
        totalIncome: settledIncome,
        totalExpense: settledExpense,
        balance: settledIncome - settledExpense,
        pendingReceive,
        pendingPay,
        rows: txs.map((t) => ({
          date: formatDateBR(t.competenceDate),
          description: t.description,
          context: t.context === "STUDIO" ? "Estúdio" : "Pessoal",
          category: t.category.name,
          status: TRANSACTION_STATUS_LABELS[t.status] || t.status,
          amount: `${t.type === "INCOME" ? "+" : "-"} ${formatBRL(t.amount)}`,
        })),
      });

      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="financeiro-zanima-${scope.toLowerCase()}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    // Exportação CSV com separador ';' e BOM UTF-8 para abrir perfeito no Excel pt-BR
    const header = [
      "Data",
      "Contexto",
      "Tipo",
      "Descrição",
      "Categoria",
      "Conta",
      "Status",
      "Valor",
    ].join(";");

    const lines = txs.map((t) =>
      [
        formatDateBR(t.competenceDate),
        t.context === "STUDIO" ? "Estúdio" : "Pessoal",
        t.type === "INCOME" ? "Receita" : "Despesa",
        `"${t.description.replaceAll('"', '""')}"`,
        `"${t.category.name.replaceAll('"', '""')}"`,
        `"${(t.account?.name || "Cartão").replaceAll('"', '""')}"`,
        TRANSACTION_STATUS_LABELS[t.status] || t.status,
        toNumber(t.amount).toFixed(2).replace(".", ","),
      ].join(";")
    );

    const csv = "\uFEFF" + [header, ...lines].join("\r\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="financeiro-zanima-${scope.toLowerCase()}.csv"`,
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
      { error: "Erro ao exportar relatório." },
      { status: 500 }
    );
  }
}
