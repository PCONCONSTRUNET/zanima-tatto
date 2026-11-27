import { Clock, Download, Wallet } from "lucide-react";
import { requireClientPage } from "@/lib/security/rbac";
import { formatBRL, formatDateBR, formatSequentialCode } from "@/lib/format";
import { getClientFinancialOverview } from "@/lib/client-payments";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/domain-labels";
import { EmptyState, StatusBadge } from "@/components/ui/primitives";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { STUDIO_OWNER_WHATSAPP } from "@/lib/pix";

export const dynamic = "force-dynamic";

export default async function ClientFinanceiroPage() {
  const user = await requireClientPage();
  const overview = user.clientId
    ? await getClientFinancialOverview(user.clientId)
    : {
        payments: [],
        openObligations: [],
        totalPaid: 0,
        totalPendingRecorded: 0,
        totalUnbilled: 0,
        totalOpen: 0,
        openCount: 0,
      };

  const { payments, openObligations, totalPaid, totalOpen } = overview;
  const pendingPayments = payments.filter((p) => p.status === "PENDING");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--brand-champagne)] font-semibold">
          Financeiro do Cliente
        </p>
        <h1 className="font-display text-2xl font-semibold mt-0.5">
          Pagamentos
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Acompanhe valores pagos, saldos em aberto e comprovantes registrados pelo estúdio.
        </p>
      </div>

      {/* Resumo Bento 2 colunas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 space-y-1">
          <p className="text-xs text-[var(--text-secondary)]">Já pago</p>
          <p className="font-display text-xl font-semibold text-[var(--status-success)] tabular-nums">
            {formatBRL(totalPaid)}
          </p>
          <p className="text-[11px] text-[var(--text-secondary)]">
            {payments.filter((p) => p.status === "CONFIRMED").length} confirmação(ões)
          </p>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 space-y-1">
          <p className="text-xs text-[var(--text-secondary)]">Em aberto</p>
          <p
            className={`font-display text-xl font-semibold tabular-nums ${
              totalOpen > 0
                ? "text-[var(--status-warning)]"
                : "text-[var(--text-primary)]"
            }`}
          >
            {formatBRL(totalOpen)}
          </p>
          <p className="text-[11px] text-[var(--text-secondary)]">
            {totalOpen > 0 ? "Saldo a pagar" : "Sem pendências"}
          </p>
        </div>
      </div>

      {/* Valores em aberto (cobranças pendentes + saldo restante de projetos) */}
      {pendingPayments.length > 0 || openObligations.length > 0 ? (
        <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[var(--border-default)] flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--status-warning)]" strokeWidth={1.6} />
            <h2 className="font-display text-sm font-semibold">
              Valores em aberto
            </h2>
          </div>

          <div className="divide-y divide-[var(--border-default)]">
            {pendingPayments.map((p) => {
              const title =
                p.project?.name || p.appointment?.title || "Cobrança do estúdio";
              const kindLabel =
                p.kind === "DEPOSIT"
                  ? "Sinal"
                  : p.kind === "PARTIAL"
                    ? "Parcela"
                    : "Pagamento";
              const payCode = formatSequentialCode(p.codeNumber, p.id);
              const waUrl = `https://wa.me/${STUDIO_OWNER_WHATSAPP}?text=${encodeURIComponent(
                `Olá Letícia! Segue o comprovante do pagamento (${kindLabel}) no valor de ${formatBRL(
                  p.amount
                )} referente a "${title}" (#${payCode}).`
              )}`;
              return (
                <div
                  key={p.id}
                  className="px-4 py-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {title}
                      </p>
                      <p className="text-[var(--text-secondary)] mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span>
                          {p.kind === "DEPOSIT"
                            ? "Sinal pendente"
                            : p.kind === "PARTIAL"
                              ? "Parcela pendente"
                              : "Pagamento pendente"}{" "}
                          •
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <PaymentMethodIcon method={p.method} size={14} />
                          {PAYMENT_METHOD_LABELS[p.method] || p.method}
                        </span>
                      </p>
                    </div>
                    {p.method === "PIX" ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#25D366]/15 border border-[#25D366]/35 text-[var(--status-success)] text-[11px] font-semibold hover:bg-[#25D366]/25 transition-colors"
                      >
                        <WhatsAppIcon size={13} />
                        Enviar comprovante
                      </a>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatBRL(p.amount)}
                    </p>
                    <StatusBadge label="Em aberto" tone="warning" />
                  </div>
                </div>
              );
            })}

            {openObligations.map((ob) => (
              <div
                key={ob.id}
                className="px-4 py-3.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {ob.title}
                  </p>
                  <p className="text-[var(--text-secondary)] tabular-nums mt-0.5">
                    {ob.subtitle} • Total {formatBRL(ob.totalAmount)} (Pago {formatBRL(ob.paidAmount)})
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-sm font-semibold tabular-nums text-[var(--status-warning)]">
                    {formatBRL(ob.remainingAmount)}
                  </p>
                  <StatusBadge label="Saldo aberto" tone="warning" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Histórico de pagamentos */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-[var(--border-default)] flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[var(--brand-champagne)]" strokeWidth={1.6} />
          <h2 className="font-display text-sm font-semibold">
            Histórico de pagamentos
          </h2>
        </div>

        {payments.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Wallet className="h-5 w-5" strokeWidth={1.5} />}
              title="Nenhum pagamento registrado ainda"
              description="Quando você pagar um sinal ou sessão com o estúdio, tudo aparecerá aqui."
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {payments.map((p) => (
              <div
                key={p.id}
                className="px-4 py-3.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {p.project?.name || p.appointment?.title || "Pagamento ao estúdio"}
                  </p>
                  <p className="text-[var(--text-secondary)] mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span>
                      {p.kind === "DEPOSIT"
                        ? "Sinal"
                        : p.kind === "PARTIAL"
                          ? "Parcial"
                          : "Integral"}{" "}
                      •
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <PaymentMethodIcon method={p.method} size={14} />
                      {PAYMENT_METHOD_LABELS[p.method] || p.method}
                    </span>
                    <span>• {formatDateBR(p.confirmedAt || p.createdAt)}</span>
                  </p>
                  {p.notes ? (
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                      {p.notes}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-semibold text-sm tabular-nums">
                    {formatBRL(p.amount)}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <a
                      href={`/api/payments/${p.id}/receipt`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    >
                      <Download className="h-3 w-3" />
                      Comprovante PDF
                    </a>
                    {p.receiptFileId ? (
                      <a
                        href={`/api/files/${p.receiptFileId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-[11px] text-[var(--text-primary)]"
                      >
                        Anexo
                      </a>
                    ) : null}
                    <StatusBadge
                      label={PAYMENT_STATUS_LABELS[p.status] || p.status}
                      tone={p.status === "CONFIRMED" ? "success" : "warning"}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
