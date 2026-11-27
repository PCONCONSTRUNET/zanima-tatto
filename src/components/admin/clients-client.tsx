"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Link2,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { TATTOO_STYLES } from "@/lib/domain-labels";
import { formatPhoneBR } from "@/lib/format";
import {
  Button,
  ConfirmModal,
  EmptyState,
  Field,
  Input,
  Textarea,
} from "@/components/ui/primitives";
import { IosDatePicker } from "@/components/ui/ios-date-picker";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

type ClientSummary = {
  id: string;
  fullName: string;
  whatsapp: string;
  email: string | null;
  hasAccount: boolean;
  verificationCode: string | null;
  preferredStyles: string[];
  counts: {
    appointments: number;
    projects: number;
    quoteRequests: number;
    documentSignatures: number;
  };
};

type LinkRequestSummary = {
  id: string;
  targetClientId: string;
  targetName: string;
  userName: string;
  userEmail: string;
  providedPhone: string | null;
};

function ClientsInner({
  initialClients,
  initialLinkRequests,
}: {
  initialClients: ClientSummary[];
  initialLinkRequests: LinkRequestSummary[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState(initialClients);
  const [linkRequests, setLinkRequests] = useState(initialLinkRequests);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(searchParams.get("novo") === "1");
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [preferredStyles, setPreferredStyles] = useState<string[]>([]);
  const [allergiesSummary, setAllergiesSummary] = useState("");
  const [initialPrivateNote, setInitialPrivateNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const handleDeleteClient = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setListError(null);
    try {
      const res = await fetch(`/api/admin/clients/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setListError(data?.error || "Não foi possível excluir o cliente.");
        setDeleteTarget(null);
        return;
      }
      const deletedId = deleteTarget.id;
      setClients((prev) => prev.filter((c) => c.id !== deletedId));
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setListError("Erro de conexão ao excluir cliente.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.whatsapp.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [clients, query]);

  const toggleStyle = (style: string) => {
    setPreferredStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          whatsapp,
          phone: phone || whatsapp,
          email,
          birthDate,
          preferredStyles,
          allergiesSummary,
          initialPrivateNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao cadastrar cliente.");
        setSaving(false);
        return;
      }
      setCreateOpen(false);
      router.push(`/admin/clientes/${data.client.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleReviewLink = async (
    req: LinkRequestSummary,
    action: "approve_link" | "reject_link"
  ) => {
    const res = await fetch(`/api/admin/clients/${req.targetClientId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, linkRequestId: req.id }),
    });
    if (res.ok) {
      setLinkRequests((prev) => prev.filter((r) => r.id !== req.id));
      if (action === "approve_link") {
        setClients((prev) =>
          prev.map((c) =>
            c.id === req.targetClientId ? { ...c, hasAccount: true } : c
          )
        );
      }
      router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold">
            Clientes
          </h1>
          <p className="text-xs text-[var(--text-secondary)] truncate">
            {clients.length}{" "}
            {clients.length === 1 ? "prontuário cadastrado" : "prontuários cadastrados"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="h-9 px-4 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-all active:scale-[0.97] cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
          <span>Novo cliente</span>
        </button>
      </div>

      {/* Solicitações de vinculação de prontuário */}
      {linkRequests.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] px-0.5">
            <Link2 className="h-4 w-4 text-[var(--status-warning)]" strokeWidth={1.5} />
            Solicitações de vinculação pendentes ({linkRequests.length})
          </div>
          <div className="space-y-2">
            {linkRequests.map((lr) => (
              <div
                key={lr.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-xs"
              >
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    Conta: {lr.userName} ({lr.userEmail})
                  </p>
                  <p className="text-[var(--text-secondary)]">
                    Prontuário alvo: {lr.targetName} • Tel: {lr.providedPhone || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleReviewLink(lr, "reject_link")}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Recusar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleReviewLink(lr, "approve_link")}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Aprovar vínculo
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Busca */}
      <div className="relative">
        <Search
          className="h-4 w-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          strokeWidth={1.6}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, WhatsApp ou e-mail..."
          className="w-full h-10 pl-10 pr-4 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)]"
        />
      </div>

      {/* Lista de Clientes (cards iOS limpos e completos) */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" strokeWidth={1.5} />}
          title="Nenhum cliente encontrado"
          description="Cadastre o primeiro cliente manualmente ou aguarde solicitações pelo portal público."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Cadastrar cliente
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => {
            const initials = c.fullName
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0] || "")
              .join("")
              .toUpperCase();
            const waDigits = c.whatsapp.replace(/\D/g, "");
            const waUrl =
              waDigits.length >= 10
                ? `https://wa.me/${waDigits.startsWith("55") ? waDigits : `55${waDigits}`}`
                : null;

            return (
              <li
                key={c.id}
                className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-colors"
              >
                <div className="flex items-center justify-between gap-2.5 px-3.5 py-3">
                  <Link
                    href={`/admin/clientes/${c.id}`}
                    className="flex items-center gap-3 min-w-0 flex-1"
                  >
                    <div className="h-10 w-10 rounded-full bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/35 flex items-center justify-center text-xs font-semibold text-[var(--brand-champagne)] shrink-0">
                      {initials || "CL"}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {c.fullName}
                        </p>
                        {c.hasAccount ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[var(--status-success-bg)] text-[var(--status-success)] text-[10px] font-semibold shrink-0">
                            <UserCheck className="h-3 w-3" strokeWidth={1.8} />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] text-[var(--text-secondary)] text-[10px] font-medium shrink-0">
                            Manual
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[var(--text-secondary)] tabular-nums truncate">
                        {c.whatsapp} • {c.counts.appointments} sess. •{" "}
                        {c.counts.projects} proj.
                      </p>

                      {c.preferredStyles.length > 0 ||
                      (c.verificationCode && !c.hasAccount) ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {c.preferredStyles.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] text-[10px] text-[var(--text-secondary)]"
                            >
                              {s}
                            </span>
                          ))}
                          {c.verificationCode && !c.hasAccount ? (
                            <span className="text-[10px] text-[var(--brand-champagne)] font-medium">
                              Vínculo: {c.verificationCode}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </Link>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`WhatsApp de ${c.fullName}`}
                        className="h-8 w-8 rounded-full bg-[var(--status-success-bg)] text-[var(--status-success)] inline-flex items-center justify-center"
                      >
                        <WhatsAppIcon size={17} />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setListError(null);
                        setDeleteTarget(c);
                      }}
                      aria-label={`Excluir ${c.fullName}`}
                      title="Excluir cliente"
                      className="h-8 w-8 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger)] inline-flex items-center justify-center cursor-pointer hover:opacity-85 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </button>
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      aria-label={`Abrir ficha de ${c.fullName}`}
                      className="h-8 w-8 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] text-[var(--text-muted)] inline-flex items-center justify-center"
                    >
                      <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal Cadastro Manual (Tela inteira no mobile, centrado no desktop) */}
      {createOpen ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <form
            onSubmit={handleCreate}
            className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/80 rounded-t-[28px] md:rounded-[26px] p-5 shadow-2xl space-y-3.5 overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">
                Novo cliente
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Fechar"
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error ? (
              <div className="p-2.5 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
                {error}
              </div>
            ) : null}

            <Field label="Nome completo">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome da cliente"
                required
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Field label="WhatsApp">
                <Input
                  type="tel"
                  inputMode="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatPhoneBR(e.target.value))}
                  placeholder="(00) 90000-0000"
                  required
                />
              </Field>
              <Field label="E-mail (opcional)">
                <Input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@email.com"
                />
              </Field>
            </div>

            <Field label="Preferências de estilo">
              <div className="flex flex-wrap gap-1.5">
                {TATTOO_STYLES.map((style) => {
                  const selected = preferredStyles.includes(style);
                  return (
                    <button
                      key={style}
                      type="button"
                      onClick={() => toggleStyle(style)}
                      className={`h-8 px-3 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                        selected
                          ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                          : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)]"
                      }`}
                    >
                      {style}
                    </button>
                  );
                })}
              </div>
            </Field>

            <button
              type="button"
              onClick={() => setShowOptionalFields((v) => !v)}
              className="w-full py-2 px-3 rounded-xl bg-[var(--bg-subtle)]/70 border border-[var(--border-default)] flex items-center justify-between text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <span>Mais informações (nascimento, telefone, alergias)</span>
              {showOptionalFields ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {showOptionalFields ? (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Field label="Telefone alternativo">
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
                      placeholder="(00) 90000-0000"
                    />
                  </Field>
                  <Field label="Data de nascimento">
                    <IosDatePicker
                      value={birthDate}
                      onChange={setBirthDate}
                    />
                  </Field>
                </div>
                <Field label="Resumo de alergias / atenção clínica">
                  <Input
                    value={allergiesSummary}
                    onChange={(e) => setAllergiesSummary(e.target.value)}
                    placeholder="Ex: Sensibilidade a adesivo micropore"
                  />
                </Field>
                <Field label="Observação interna inicial (privada)">
                  <Textarea
                    value={initialPrivateNote}
                    onChange={(e) => setInitialPrivateNote(e.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Cadastrar cliente"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {listError ? (
        <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs flex items-center justify-between gap-2">
          <span>{listError}</span>
          <button
            type="button"
            onClick={() => setListError(null)}
            className="underline font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Excluir cliente?"
        description={
          deleteTarget
            ? `Remover "${deleteTarget.fullName}" e seus agendamentos, orçamentos e histórico vinculados? Esta ação não pode ser desfeita.`
            : "Esta ação remove o cadastro do cliente."
        }
        confirmLabel="Excluir cliente"
        loading={deleting}
        onConfirm={handleDeleteClient}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export function ClientsListClient(props: {
  initialClients: ClientSummary[];
  initialLinkRequests: LinkRequestSummary[];
}) {
  return (
    <Suspense fallback={<div className="text-xs text-[var(--text-secondary)]">Carregando clientes...</div>}>
      <ClientsInner {...props} />
    </Suspense>
  );
}
