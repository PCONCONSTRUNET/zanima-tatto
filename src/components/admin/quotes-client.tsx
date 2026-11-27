"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightCircle,
  Check,
  Download,
  Plus,
  Receipt,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { formatBRL, formatDateBR } from "@/lib/format";
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_TONE,
  TATTOO_STYLES,
} from "@/lib/domain-labels";
import {
  Button,
  ConfirmModal,
  CurrencyInput,
  EmptyState,
  Field,
  Input,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";

type QuoteItem = {
  id: string;
  clientId: string;
  clientName: string;
  clientWhatsapp: string;
  title: string;
  ideaDescription: string;
  style: string;
  bodyRegion: string;
  approxSizeCm: string;
  availabilityText: string | null;
  clientNotes: string | null;
  referenceFileIds: string[];
  status: string;
  quotedAmount: number | null;
  depositAmount: number | null;
  paymentTerms: string | null;
  validUntil: string | null;
  adminNotes: string | null;
  convertedProjectId: string | null;
  createdAt: string;
};

type ClientOption = {
  id: string;
  fullName: string;
  whatsapp: string;
  phone: string;
};

const QUOTE_PAYMENT_METHODS = [
  { id: "PIX", label: "Pix" },
  { id: "CREDIT_CARD", label: "Cartão" },
  { id: "CASH", label: "Dinheiro" },
] as const;

function QuotesInner({
  todayStr,
  initialQuotes,
  clients,
}: {
  todayStr: string;
  initialQuotes: QuoteItem[];
  clients: ClientOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quotes, setQuotes] = useState(initialQuotes);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<QuoteItem | null>(null);
  const [createOpen, setCreateOpen] = useState(
    searchParams.get("novo") === "1"
  );
  const [deleteTarget, setDeleteTarget] = useState<QuoteItem | null>(null);

  // Formulário análise/envio
  const [quotedAmount, setQuotedAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Pix");
  const [validUntil, setValidUntil] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [convertSchedule, setConvertSchedule] = useState(false);
  const [convDate, setConvDate] = useState(todayStr);
  const [convTime, setConvTime] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Novo orçamento manual
  const [clientSearch, setClientSearch] = useState("");
  const [newClientId, setNewClientId] = useState(clients[0]?.id || "");
  const [newTitle, setNewTitle] = useState("");
  const [newStyle, setNewStyle] = useState<string>(TATTOO_STYLES[0]);
  const [newRegion, setNewRegion] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const filteredQuotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    if (!q) return quotes;
    return quotes.filter((item) => {
      if (item.clientName.toLowerCase().includes(q)) return true;
      if (item.title.toLowerCase().includes(q)) return true;
      if (item.style.toLowerCase().includes(q)) return true;
      if (item.bodyRegion.toLowerCase().includes(q)) return true;
      if (
        digits &&
        item.clientWhatsapp.replace(/\D/g, "").includes(digits)
      ) {
        return true;
      }
      return item.clientWhatsapp.toLowerCase().includes(q);
    });
  }, [quotes, searchQuery]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    if (!q) return clients;
    return clients.filter((c) => {
      if (c.fullName.toLowerCase().includes(q)) return true;
      if (
        digits &&
        (c.whatsapp.replace(/\D/g, "").includes(digits) ||
          c.phone.replace(/\D/g, "").includes(digits))
      ) {
        return true;
      }
      return (
        c.whatsapp.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
      );
    });
  }, [clients, clientSearch]);

  const selectedClientObj = useMemo(
    () => clients.find((c) => c.id === newClientId) || null,
    [clients, newClientId]
  );

  const openQuote = (q: QuoteItem) => {
    setSelected(q);
    setQuotedAmount(q.quotedAmount !== null ? String(q.quotedAmount) : "");
    setDepositAmount(q.depositAmount !== null ? String(q.depositAmount) : "");
    setPaymentTerms(q.paymentTerms || "Pix");
    setValidUntil(q.validUntil || "");
    setAdminNotes(q.adminNotes || "");
    setError(null);
  };

  const reload = async () => {
    const res = await fetch("/api/admin/quotes");
    if (res.ok) {
      const data = await res.json();
      setQuotes(
        data.quotes.map(
          (
            q: QuoteItem & { client: { fullName: string; whatsapp: string } }
          ) => ({
            ...q,
            clientName: q.client.fullName,
            clientWhatsapp: q.client.whatsapp,
            quotedAmount:
              q.quotedAmount !== null ? Number(q.quotedAmount) : null,
            depositAmount:
              q.depositAmount !== null ? Number(q.depositAmount) : null,
            validUntil: q.validUntil ? String(q.validUntil).slice(0, 10) : null,
          })
        )
      );
      router.refresh();
    }
  };

  const handleSaveProposal = async (sendToClient: boolean) => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quotes/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotedAmount: quotedAmount ? Number(quotedAmount) : undefined,
          depositAmount: depositAmount ? Number(depositAmount) : undefined,
          paymentTerms,
          validUntil: validUntil || null,
          adminNotes: adminNotes || null,
          status: sendToClient ? "SENT" : "ANALYZING",
          sendToClient,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao atualizar proposta.");
        return;
      }
      setSelected(null);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quotes/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert",
          plannedSessions: 1,
          scheduleSession: convertSchedule,
          date: convertSchedule ? convDate : undefined,
          startTime: convertSchedule ? convTime : undefined,
          durationMinutes: 120,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível converter.");
        return;
      }
      setSelected(null);
      router.push(`/admin/projetos/${data.project.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: newClientId,
          title: newTitle,
          style: newStyle.trim() || "Personalizado",
          bodyRegion: newRegion,
          approxSizeCm: newSize,
          ideaDescription: newDesc,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível criar o orçamento.");
        return;
      }
      setCreateOpen(false);
      setNewTitle("");
      setNewRegion("");
      setNewSize("");
      setNewDesc("");
      setClientSearch("");
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/quotes/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setQuotes((prev) => prev.filter((q) => q.id !== deleteTarget.id));
        if (selected?.id === deleteTarget.id) setSelected(null);
        setDeleteTarget(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">
            Orçamentos Personalizados
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Analise solicitações, defina formas de pagamento, envie em PDF ou converta em projetos.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setError(null);
            setCreateOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Novo orçamento
        </Button>
      </div>

      {/* Busca por nome, telefone ou ideia */}
      {quotes.length > 0 ? (
        <div className="relative">
          <Search className="h-4 w-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome do cliente, telefone, estilo ou ideia..."
            className="w-full h-10 pl-9 pr-4 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)]"
          />
        </div>
      ) : null}

      {filteredQuotes.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-5 w-5" strokeWidth={1.5} />}
          title={
            quotes.length === 0
              ? "Nenhum orçamento registrado"
              : "Nenhum orçamento encontrado para essa busca"
          }
          description="Solicitações enviadas pelo portal público ou criadas manualmente aparecerão aqui."
          action={
            quotes.length === 0 ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Criar orçamento
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] divide-y divide-[var(--border-default)] overflow-hidden">
          {filteredQuotes.map((q) => (
            <div
              key={q.id}
              onClick={() => openQuote(q)}
              className="p-4 flex items-center justify-between gap-3 hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {q.title}
                </p>
                <p className="text-xs text-[var(--text-secondary)] truncate">
                  {q.clientName} ({q.clientWhatsapp}) • {q.style} • {q.bodyRegion}{" "}
                  ({q.approxSizeCm}) • {formatDateBR(q.createdAt)}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <StatusBadge
                    label={QUOTE_STATUS_LABELS[q.status] || q.status}
                    tone={QUOTE_STATUS_TONE[q.status] || "neutral"}
                  />
                  {q.quotedAmount !== null ? (
                    <span className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                      {formatBRL(q.quotedAmount)}
                    </span>
                  ) : null}
                  {q.paymentTerms ? (
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      • {q.paymentTerms}
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                aria-label={`Excluir orçamento ${q.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(q);
                }}
                className="h-8 w-8 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger)] inline-flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Análise e Conversão (Tela inteira no mobile, centrado no desktop) */}
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4">
          <div className="w-full max-h-[88dvh] md:max-w-xl bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 rounded-t-[28px] md:rounded-3xl p-5 space-y-4 overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold truncate">
                  {selected.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {selected.clientName} ({selected.clientWhatsapp}) •{" "}
                  {selected.style}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`/api/admin/quotes/${selected.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-[var(--border-default)] text-xs font-medium hover:bg-[var(--bg-subtle)]"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  PDF
                </a>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(selected)}
                  aria-label="Excluir orçamento"
                  className="h-8 w-8 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger)] inline-flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Fechar"
                  className="h-8 w-8 rounded-full bg-[var(--bg-canvas)] text-[var(--text-secondary)] inline-flex items-center justify-center cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {error ? (
              <div className="p-3 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
                {error}
              </div>
            ) : null}

            <div className="p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] text-xs space-y-1">
              <p>
                <strong>Região / Tamanho:</strong> {selected.bodyRegion} (
                {selected.approxSizeCm})
              </p>
              <p>
                <strong>Ideia:</strong> {selected.ideaDescription}
              </p>
              {selected.availabilityText ? (
                <p>
                  <strong>Disponibilidade:</strong> {selected.availabilityText}
                </p>
              ) : null}
            </div>

            {selected.referenceFileIds.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto">
                {selected.referenceFileIds.map((fid) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={fid}
                    src={`/api/files/${fid}`}
                    alt="Referência enviada"
                    className="h-20 w-20 object-cover rounded-xl border border-[var(--border-default)]"
                  />
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Valor">
                <CurrencyInput
                  value={quotedAmount}
                  onValueChange={setQuotedAmount}
                />
              </Field>
              <Field label="Sinal">
                <CurrencyInput
                  value={depositAmount}
                  onValueChange={setDepositAmount}
                />
              </Field>
              <Field label="Validade">
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Condições de pagamento">
              <div className="grid grid-cols-3 gap-2">
                {QUOTE_PAYMENT_METHODS.map((pm) => {
                  const active =
                    paymentTerms.toLowerCase() === pm.label.toLowerCase();
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentTerms(pm.label)}
                      className={`h-11 px-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                        active
                          ? "border-[var(--brand-champagne)] bg-[var(--brand-champagne-subtle)] text-[var(--text-primary)]"
                          : "border-[var(--border-default)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <PaymentMethodIcon method={pm.id} size={18} />
                      <span>{pm.label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Observações para o cliente">
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </Field>

            {!selected.convertedProjectId ? (
              <div className="p-3.5 rounded-2xl border border-[var(--border-default)] space-y-2.5 text-xs">
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={convertSchedule}
                    onChange={(e) => setConvertSchedule(e.target.checked)}
                  />
                  Ao converter em projeto, já agendar primeira sessão
                </label>
                {convertSchedule ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={convDate}
                      onChange={(e) => setConvDate(e.target.value)}
                      className="h-9 text-xs"
                    />
                    <Input
                      type="time"
                      value={convTime}
                      onChange={(e) => setConvTime(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <Link
                href={`/admin/projetos/${selected.convertedProjectId}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--status-success)] underline"
              >
                Ver projeto convertido
              </Link>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => setSelected(null)}
                disabled={saving}
              >
                Fechar
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleSaveProposal(false)}
                disabled={saving}
              >
                Salvar rascunho
              </Button>
              <Button
                onClick={() => handleSaveProposal(true)}
                disabled={saving}
              >
                <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
                Enviar ao cliente
              </Button>
              {!selected.convertedProjectId ? (
                <Button onClick={handleConvert} disabled={saving}>
                  <ArrowRightCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Converter em projeto
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Criar Orçamento Manual (Tela inteira no mobile, centrado no desktop) */}
      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4">
          <form
            onSubmit={handleCreateManual}
            className="w-full max-h-[88dvh] md:max-w-lg bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 rounded-t-[28px] md:rounded-3xl p-5 space-y-4 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold">
                Novo orçamento manual
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Fechar"
                className="h-8 w-8 rounded-full bg-[var(--bg-canvas)] text-[var(--text-secondary)] inline-flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error ? (
              <div className="p-3 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Field label="Buscar cliente (nome ou telefone)">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Digite nome ou WhatsApp/telefone..."
                    className="pl-8"
                  />
                </div>
              </Field>

              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-canvas)] max-h-36 overflow-y-auto divide-y divide-[var(--border-default)]">
                {filteredClients.length === 0 ? (
                  <p className="px-3 py-2.5 text-xs text-[var(--text-muted)]">
                    Nenhum cliente encontrado para essa busca.
                  </p>
                ) : (
                  filteredClients.map((c) => {
                    const isSelected = c.id === newClientId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setNewClientId(c.id)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[var(--brand-champagne-subtle)] text-[var(--text-primary)] font-semibold"
                            : "hover:bg-[var(--bg-surface)] text-[var(--text-primary)]"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate">{c.fullName}</p>
                          <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                            {c.whatsapp}
                          </p>
                        </div>
                        {isSelected ? (
                          <Check className="h-3.5 w-3.5 text-[var(--brand-champagne)] shrink-0" />
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>

              {selectedClientObj ? (
                <p className="text-[11px] text-[var(--brand-champagne)]">
                  Selecionado: <strong>{selectedClientObj.fullName}</strong> (
                  {selectedClientObj.whatsapp})
                </p>
              ) : null}
            </div>

            <Field label="Título da ideia">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Floral no antebraço"
                required
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <Field label="Estilo (digite ou escolha)">
                <Input
                  list="quote-styles-datalist"
                  value={newStyle}
                  onChange={(e) => setNewStyle(e.target.value)}
                  placeholder="Digite o estilo..."
                  required
                />
                <datalist id="quote-styles-datalist">
                  {TATTOO_STYLES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>
              <Field label="Região">
                <Input
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  placeholder="Ex: Antebraço"
                  required
                />
              </Field>
              <Field label="Tamanho">
                <Input
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  placeholder="Ex: 12 cm"
                  required
                />
              </Field>
            </div>

            <Field label="Descrição">
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Detalhes da ideia..."
                required
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !newClientId}>
                {saving ? "Salvando..." : "Criar orçamento"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Excluir orçamento?"
        description={`O orçamento "${deleteTarget?.title || ""}" (${deleteTarget?.clientName || ""}) será excluído permanentemente.`}
        confirmLabel="Excluir orçamento"
        danger
        loading={saving}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export function QuotesClient(props: {
  todayStr: string;
  initialQuotes: QuoteItem[];
  clients: ClientOption[];
}) {
  return (
    <Suspense
      fallback={
        <div className="text-xs text-[var(--text-secondary)]">
          Carregando orçamentos...
        </div>
      }
    >
      <QuotesInner {...props} />
    </Suspense>
  );
}
