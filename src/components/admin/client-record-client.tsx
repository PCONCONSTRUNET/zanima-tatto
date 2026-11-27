"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, KeyRound, Lock, Plus, Trash2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import {
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
} from "@/lib/format";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PROJECT_STAGE_LABELS,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_TONE,
} from "@/lib/domain-labels";
import {
  Button,
  ConfirmModal,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";

type ClientDetail = {
  id: string;
  fullName: string;
  phone: string;
  whatsapp: string;
  email: string | null;
  birthDate: string | null;
  preferredStyles: string[];
  allergiesSummary: string | null;
  marketingOptIn: boolean;
  hasAccount: boolean;
  accountEmail: string | null;
  verificationCode: string | null;
  avatarFileId: string | null;
  createdAt: string;
  notes: Array<{
    id: string;
    content: string;
    authorName: string;
    createdAt: string;
  }>;
  appointments: Array<{
    id: string;
    title: string;
    startAt: string;
    durationMinutes: number;
    status: string;
    projectName: string | null;
  }>;
  projects: Array<{
    id: string;
    name: string;
    style: string;
    bodyRegion: string;
    stage: string;
    negotiatedAmount: number;
    paidAmount: number;
    photos: Array<{
      id: string;
      fileId: string;
      kind: string;
      caption: string | null;
    }>;
  }>;
  quotes: Array<{
    id: string;
    title: string;
    style: string;
    status: string;
    quotedAmount: number | null;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    kind: string;
    method: string;
    amount: number;
    status: string;
    referenceTitle: string | null;
    createdAt: string;
  }>;
  transactions: Array<{
    id: string;
    description: string;
    categoryName: string;
    method: string;
    amount: number;
    status: string;
    competenceDate: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    kind: string;
    version: number;
    signedAt: string;
  }>;
};

type TabKey =
  | "resumo"
  | "agenda"
  | "projetos"
  | "financeiro"
  | "orcamentos"
  | "notas";

export function ClientRecordClient({ client }: { client: ClientDetail }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("resumo");
  const [verificationCode, setVerificationCode] = useState(
    client.verificationCode
  );

  const [notes, setNotes] = useState(client.notes);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteClient = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setDeleteError(data?.error || "Não foi possível excluir o cliente.");
        setDeleteOpen(false);
        return;
      }
      setDeleteOpen(false);
      router.push("/admin/clientes");
      router.refresh();
    } catch {
      setDeleteError("Erro de conexão ao excluir cliente.");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const whatsappDigits = client.whatsapp.replace(/\D/g, "");
  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits.length <= 11 ? `55${whatsappDigits}` : whatsappDigits}`
    : null;

  const handleRegenerateCode = async () => {
    const res = await fetch(`/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerateCode: true }),
    });
    if (res.ok) {
      const data = await res.json();
      setVerificationCode(data.client.identityVerificationCode);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_note",
          content: newNote,
          isPrivate: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotes((prev) => [
          {
            id: data.note.id,
            content: data.note.content,
            authorName: data.note.author.name,
            createdAt: data.note.createdAt,
          },
          ...prev,
        ]);
        setNewNote("");
      }
    } finally {
      setSavingNote(false);
    }
  };

  const allPhotos = client.projects.flatMap((p) =>
    p.photos.map((ph) => ({ ...ph, projectName: p.name }))
  );

  const initials = client.fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Link
          href="/admin/clientes"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Todos os clientes
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-full bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/40 flex items-center justify-center text-sm font-semibold text-[var(--brand-champagne)] shrink-0">
              {initials || "CL"}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold text-[var(--text-primary)] truncate">
                {client.fullName}
              </h1>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {client.whatsapp}
                {client.email ? ` • ${client.email}` : ""} • Desde{" "}
                {formatDateBR(client.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {client.hasAccount ? (
              <StatusBadge
                label={`Conta vinculada (${client.accountEmail})`}
                tone="success"
              />
            ) : (
              <>
                <StatusBadge
                  label={
                    verificationCode
                      ? `Vínculo: ${verificationCode}`
                      : "Manual"
                  }
                  tone="info"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleRegenerateCode}
                  title="Gerar novo código de verificação para o cliente vincular ao criar conta"
                >
                  <KeyRound className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Novo código
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }}
              title="Excluir cliente"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
              Excluir
            </Button>
          </div>
        </div>

        {deleteError ? (
          <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs flex items-center justify-between gap-2">
            <span>{deleteError}</span>
            <button
              type="button"
              onClick={() => setDeleteError(null)}
              className="underline font-semibold cursor-pointer"
            >
              Fechar
            </button>
          </div>
        ) : null}
      </div>

      {/* Navegação por Abas Simétrica */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
        {(
          [
            ["resumo", "Dados"],
            ["agenda", `Agenda (${client.appointments.length})`],
            ["projetos", `Tattoos (${client.projects.length})`],
            [
              "financeiro",
              `Pagamentos (${client.payments.length + client.transactions.length})`,
            ],
            ["orcamentos", `Orçam. (${client.quotes.length})`],
            ["notas", `Notas (${notes.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`h-9 px-2 rounded-xl text-[11px] font-medium whitespace-nowrap truncate transition-all cursor-pointer ${
              tab === key
                ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "resumo" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <h2 className="font-display text-sm font-semibold">
                  Dados cadastrais e preferências
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                  Somente leitura
                </span>
              </div>

              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] divide-y divide-[var(--border-default)] text-xs overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">Nome completo</span>
                <span className="font-semibold text-[var(--text-primary)] text-right">
                  {client.fullName}
                </span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">WhatsApp</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--text-primary)] tabular-nums">
                    {client.whatsapp}
                  </span>
                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Abrir WhatsApp"
                      className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-[var(--status-success-bg)] text-[var(--status-success)]"
                    >
                      <WhatsAppIcon size={15} />
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">Telefone</span>
                <span className="font-medium text-[var(--text-primary)] tabular-nums">
                  {client.phone || "—"}
                </span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">E-mail</span>
                <span className="font-medium text-[var(--text-primary)] truncate">
                  {client.email || "Não informado"}
                </span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">
                  Data de nascimento
                </span>
                <span className="font-medium text-[var(--text-primary)] tabular-nums">
                  {client.birthDate ? formatDateBR(client.birthDate) : "Não informada"}
                </span>
              </div>

              <div className="px-4 py-3 space-y-2">
                <span className="text-[var(--text-secondary)] block">
                  Preferências de estilo
                </span>
                {client.preferredStyles.length === 0 ? (
                  <span className="text-[var(--text-muted)] block">
                    Nenhum estilo selecionado pela cliente.
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {client.preferredStyles.map((style) => (
                      <span
                        key={style}
                        className="h-7 px-3 inline-flex items-center rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-xs font-medium text-[var(--text-primary)]"
                      >
                        {style}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-4 py-3 space-y-1">
                <span className="text-[var(--text-secondary)] block">
                  Observações clínicas / alergias
                </span>
                <p className="text-[var(--text-primary)]">
                  {client.allergiesSummary || "Nenhuma alergia registrada."}
                </p>
              </div>
              </div>
            </div>

            {/* Pagamentos registrados no perfil do cliente */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <h2 className="font-display text-sm font-semibold">
                  Pagamentos do cliente ({client.payments.length + client.transactions.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setTab("financeiro")}
                  className="text-xs font-medium text-[var(--brand-champagne)] hover:underline cursor-pointer"
                >
                  Ver tudo
                </button>
              </div>

              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] divide-y divide-[var(--border-default)] overflow-hidden">
                {client.payments.length === 0 && client.transactions.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-[var(--text-secondary)]">
                    Nenhum pagamento registrado para este cliente ainda.
                  </p>
                ) : (
                  <>
                    {client.payments.slice(0, 4).map((pay) => (
                      <div
                        key={`res-pay-${pay.id}`}
                        className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[var(--text-primary)] truncate">
                            {pay.referenceTitle ||
                              (pay.kind === "DEPOSIT"
                                ? "Sinal de reserva"
                                : pay.kind === "PARTIAL"
                                  ? "Pagamento parcial"
                                  : "Pagamento integral")}
                          </p>
                          <p className="text-[var(--text-secondary)] flex items-center gap-1.5 mt-0.5">
                            <PaymentMethodIcon method={pay.method} size={13} />
                            <span>
                              {PAYMENT_METHOD_LABELS[pay.method] || pay.method} •{" "}
                              {formatDateBR(pay.createdAt)}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-2">
                          <span className="font-semibold tabular-nums">
                            {formatBRL(pay.amount)}
                          </span>
                          <a
                            href={`/api/payments/${pay.id}/receipt`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Comprovante PDF"
                            className="h-7 px-2 inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-[11px] font-medium"
                          >
                            <Download className="h-3 w-3" />
                            PDF
                          </a>
                        </div>
                      </div>
                    ))}
                    {client.transactions.slice(0, 4).map((tx) => (
                      <div
                        key={`res-tx-${tx.id}`}
                        className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[var(--text-primary)] truncate">
                            {tx.description}
                          </p>
                          <p className="text-[var(--text-secondary)] flex items-center gap-1.5 mt-0.5">
                            <PaymentMethodIcon method={tx.method} size={13} />
                            <span>
                              {tx.categoryName} •{" "}
                              {PAYMENT_METHOD_LABELS[tx.method] || tx.method} •{" "}
                              {formatDateBR(tx.competenceDate)}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-2">
                          <span className="font-semibold tabular-nums text-[var(--status-success)]">
                            {formatBRL(tx.amount)}
                          </span>
                          <a
                            href={`/api/admin/finance/transactions/${tx.id}/receipt`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Comprovante PDF"
                            className="h-7 px-2 inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-[11px] font-medium"
                          >
                            <Download className="h-3 w-3" />
                            PDF
                          </a>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold">
              Fotografias e referências ({allPhotos.length})
            </h2>
            {allPhotos.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Nenhuma fotografia associada aos projetos deste cliente.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {allPhotos.map((ph) => (
                  <div
                    key={ph.id}
                    className="border border-[var(--border-default)] rounded-[6px] overflow-hidden bg-[var(--bg-subtle)]"
                  >
                    <img
                      src={`/api/files/${ph.fileId}`}
                      alt={ph.caption || ph.projectName}
                      className="h-28 w-full object-cover"
                    />
                    <div className="p-2 text-[11px] truncate text-[var(--text-secondary)]">
                      {ph.projectName}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "agenda" ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] divide-y divide-[var(--border-default)]">
          {client.appointments.length === 0 ? (
            <p className="p-5 text-xs text-[var(--text-secondary)]">
              Sem agendamentos registrados.
            </p>
          ) : (
            client.appointments.map((a) => (
              <div
                key={a.id}
                className="px-4 py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] tabular-nums">
                    {formatDateTimeBR(a.startAt)} • {a.durationMinutes} min
                    {a.projectName ? ` • ${a.projectName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`/api/admin/appointments/${a.id}/receipt`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-7 px-2.5 inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </a>
                  <StatusBadge
                    label={APPOINTMENT_STATUS_LABELS[a.status] || a.status}
                    tone={APPOINTMENT_STATUS_TONE[a.status] || "neutral"}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "projetos" ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] divide-y divide-[var(--border-default)]">
          {client.projects.length === 0 ? (
            <p className="p-5 text-xs text-[var(--text-secondary)]">
              Nenhum projeto de tatuagem cadastrado.
            </p>
          ) : (
            client.projects.map((p) => (
              <Link
                key={p.id}
                href={`/admin/projetos/${p.id}`}
                className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-[var(--bg-subtle)]"
              >
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {p.style} • {p.bodyRegion} • Pago:{" "}
                    <span className="tabular-nums">
                      {formatBRL(p.paidAmount)} / {formatBRL(p.negotiatedAmount)}
                    </span>
                  </p>
                </div>
                <StatusBadge
                  label={PROJECT_STAGE_LABELS[p.stage] || p.stage}
                  tone="info"
                />
              </Link>
            ))
          )}
        </div>
      ) : null}

      {tab === "financeiro" ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl divide-y divide-[var(--border-default)] overflow-hidden">
          {client.payments.length === 0 && client.transactions.length === 0 ? (
            <p className="p-5 text-xs text-[var(--text-secondary)]">
              Nenhum pagamento registrado para este cliente.
            </p>
          ) : (
            <>
              {client.payments.map((pay) => (
                <div
                  key={`pay-${pay.id}`}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-medium text-sm text-[var(--text-primary)]">
                      {pay.referenceTitle ||
                        (pay.kind === "DEPOSIT"
                          ? "Sinal de reserva"
                          : pay.kind === "PARTIAL"
                            ? "Pagamento parcial"
                            : "Pagamento integral")}
                    </p>
                    <p className="text-[var(--text-secondary)] flex items-center gap-1.5">
                      <PaymentMethodIcon method={pay.method} size={14} />
                      <span>
                        {PAYMENT_METHOD_LABELS[pay.method] || pay.method} •{" "}
                        {formatDateBR(pay.createdAt)}
                      </span>
                    </p>
                  </div>
                  <div className="text-right space-y-1 flex flex-col items-end">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatBRL(pay.amount)}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`/api/payments/${pay.id}/receipt`}
                        target="_blank"
                        rel="noreferrer"
                        className="h-6 px-2 inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                      >
                        <Download className="h-3 w-3" />
                        Comprovante
                      </a>
                      <StatusBadge
                        label={PAYMENT_STATUS_LABELS[pay.status] || pay.status}
                        tone={pay.status === "CONFIRMED" ? "success" : "warning"}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {client.transactions.map((tx) => (
                <div
                  key={`tx-${tx.id}`}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-medium text-sm text-[var(--text-primary)]">
                      {tx.description}
                    </p>
                    <p className="text-[var(--text-secondary)] flex items-center gap-1.5">
                      <PaymentMethodIcon method={tx.method} size={14} />
                      <span>
                        {tx.categoryName} •{" "}
                        {PAYMENT_METHOD_LABELS[tx.method] || tx.method} •{" "}
                        {formatDateBR(tx.competenceDate)}
                      </span>
                    </p>
                  </div>
                  <div className="text-right space-y-1 flex flex-col items-end">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatBRL(tx.amount)}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`/api/admin/finance/transactions/${tx.id}/receipt`}
                        target="_blank"
                        rel="noreferrer"
                        className="h-6 px-2 inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                      >
                        <Download className="h-3 w-3" />
                        Comprovante
                      </a>
                      <StatusBadge
                        label={
                          tx.status === "PAID" || tx.status === "RECEIVED"
                            ? "Confirmado"
                            : "Pendente"
                        }
                        tone={
                          tx.status === "PAID" || tx.status === "RECEIVED"
                            ? "success"
                            : "warning"
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : null}

      {tab === "orcamentos" ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] divide-y divide-[var(--border-default)]">
          {client.quotes.length === 0 ? (
            <p className="p-5 text-xs text-[var(--text-secondary)]">
              Nenhum orçamento registrado.
            </p>
          ) : (
            client.quotes.map((q) => (
              <div
                key={q.id}
                className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="text-sm font-medium">{q.title}</p>
                  <p className="text-[var(--text-secondary)]">
                    {q.style} • {formatDateBR(q.createdAt)}
                    {q.quotedAmount !== null
                      ? ` • ${formatBRL(q.quotedAmount)}`
                      : ""}
                  </p>
                </div>
                <StatusBadge
                  label={QUOTE_STATUS_LABELS[q.status] || q.status}
                  tone={QUOTE_STATUS_TONE[q.status] || "neutral"}
                />
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "notas" ? (
        <div className="space-y-4">
          <div className="p-3 rounded-[6px] bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            <span>
              Estas observações são estritamente privadas da administração e nunca são exibidas na Área do Cliente.
            </span>
          </div>

          <form
            onSubmit={handleAddNote}
            className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-4 space-y-3"
          >
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Adicionar observação privada ao prontuário..."
              required
            />
            <Button type="submit" size="sm" disabled={savingNote}>
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              {savingNote ? "Registrando..." : "Registrar observação privada"}
            </Button>
          </form>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] divide-y divide-[var(--border-default)]">
            {notes.length === 0 ? (
              <p className="p-5 text-xs text-[var(--text-secondary)]">
                Nenhuma observação privada registrada.
              </p>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="p-4 space-y-1">
                  <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                    {n.content}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {n.authorName} • {formatDateTimeBR(n.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={deleteOpen}
        title="Excluir cliente?"
        description={`Remover "${client.fullName}" e seus agendamentos, orçamentos e histórico vinculados? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir cliente"
        loading={deleting}
        onConfirm={handleDeleteClient}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
