"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Save, ShieldCheck, UserPlus } from "lucide-react";
import { formatDateTimeBR } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/domain-labels";
import {
  Button,
  CurrencyInput,
  Field,
  Input,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";

export function SettingsClient({
  isOwner,
  settings,
  gateways,
  staffUsers,
  lgpdRequests,
  auditLogs,
  clients,
  studioAccounts,
}: {
  isOwner: boolean;
  settings: {
    studioName: string;
    ownerName: string;
    instagramHandle: string;
    whatsappNumber: string;
    email: string;
    address: string;
    cityState: string;
    defaultDepositPercent: number;
    cancellationPolicyHours: number;
    heroHeadline: string;
    heroSubheadline: string;
    bioText: string;
  };
  gateways: Array<{ name: string; configured: boolean; webhookPath: string }>;
  staffUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
  }>;
  lgpdRequests: Array<{
    id: string;
    type: string;
    status: string;
    clientName: string;
    requestedAt: string;
    notes: string | null;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    actorName: string;
    createdAt: string;
  }>;
  clients: Array<{ id: string; fullName: string }>;
  studioAccounts: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Novo membro de equipe (futuro)
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");

  // Registro manual de pagamento com vínculo no financeiro do estúdio
  const [payClientId, setPayClientId] = useState(clients[0]?.id || "");
  const [payAccountId, setPayAccountId] = useState(studioAccounts[0]?.id || "");
  const [payKind, setPayKind] = useState<"DEPOSIT" | "PARTIAL" | "FULL">("DEPOSIT");
  const [payMethod, setPayMethod] = useState("PIX");
  const [payAmount, setPayAmount] = useState("");

  const handleSaveStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_studio", ...form }),
      });
      if (res.ok) {
        setMsg("Configurações e conteúdo público atualizados.");
        router.refresh();
      } else {
        setError("Erro ao salvar configurações.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_staff",
          name: staffName,
          email: staffEmail,
          password: staffPassword,
          permissions: {
            agenda: true,
            clients: true,
            projects: true,
            quotes: true,
            studioFinance: false,
            stock: true,
            documents: true,
            loyalty: false,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível criar colaborador.");
      } else {
        setStaffName("");
        setStaffEmail("");
        setStaffPassword("");
        setMsg("Colaborador cadastrado (sem acesso ao financeiro pessoal).");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: payClientId,
          accountId: payAccountId || null,
          kind: payKind,
          method: payMethod,
          amount: Number(payAmount),
          status: "CONFIRMED",
        }),
      });
      if (res.ok) {
        setPayAmount("");
        setMsg("Pagamento confirmado e consolidado na Central Financeira do Estúdio.");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Erro ao registrar pagamento.");
      }
    } finally {
      setSaving(false);
    }
  };

  const processLgpd = async (
    requestId: string,
    decision: "COMPLETED" | "REJECTED"
  ) => {
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "process_lgpd", requestId, decision }),
    });
    if (res.ok) router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">
          Configurações, Pagamentos, Equipe e LGPD
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Gerencie o estúdio, o conteúdo dinâmico do portal público, gateways de pagamento e auditoria.
        </p>
      </div>

      {msg ? (
        <div className="p-3 rounded-[6px] bg-[var(--status-success-bg)] text-[var(--status-success)] text-xs">
          {msg}
        </div>
      ) : null}
      {error ? (
        <div className="p-3 rounded-[6px] bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Dados do Estúdio & Portal Público */}
        <form
          onSubmit={handleSaveStudio}
          className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-4"
        >
          <h2 className="font-display text-sm font-semibold">
            Dados do Estúdio e Conteúdo do Portal Público
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome do estúdio">
              <Input
                value={form.studioName}
                onChange={(e) => setForm({ ...form, studioName: e.target.value })}
              />
            </Field>
            <Field label="Responsável / Tatuadora">
              <Input
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Instagram">
              <Input
                value={form.instagramHandle}
                onChange={(e) =>
                  setForm({ ...form, instagramHandle: e.target.value })
                }
              />
            </Field>
            <Field label="WhatsApp (com DDI 55)">
              <Input
                type="tel"
                inputMode="tel"
                value={form.whatsappNumber}
                onChange={(e) =>
                  setForm({ ...form, whatsappNumber: e.target.value })
                }
                placeholder="+55 (11) 99999-9999"
              />
            </Field>
            <Field label="Cidade / Estado">
              <Input
                value={form.cityState}
                onChange={(e) => setForm({ ...form, cityState: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sinal padrão (%)">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.defaultDepositPercent}
                onChange={(e) =>
                  setForm({
                    ...form,
                    defaultDepositPercent: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Prazo cancelamento (horas)">
              <Input
                type="number"
                min={0}
                max={168}
                value={form.cancellationPolicyHours}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cancellationPolicyHours: Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>

          <Field label="Título principal (Hero do portal)">
            <Input
              value={form.heroHeadline}
              onChange={(e) => setForm({ ...form, heroHeadline: e.target.value })}
            />
          </Field>
          <Field label="Subtítulo (Portal público)">
            <Input
              value={form.heroSubheadline}
              onChange={(e) =>
                setForm({ ...form, heroSubheadline: e.target.value })
              }
            />
          </Field>
          <Field label="Apresentação da tatuadora">
            <Textarea
              value={form.bioText}
              onChange={(e) => setForm({ ...form, bioText: e.target.value })}
            />
          </Field>

          <Button type="submit" disabled={saving}>
            <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
            Salvar configurações do portal
          </Button>
        </form>

        {/* Gateways & Pagamento Rápido */}
        <div className="lg:col-span-5 space-y-5">
          <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4" strokeWidth={1.5} />
              Gateways de Pagamento (Estrutura Plugável)
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Webhooks autenticados por assinatura HMAC e idempotência ativa no servidor.
            </p>
            <div className="space-y-2">
              {gateways.map((g) => (
                <div
                  key={g.name}
                  className="p-3 rounded-[6px] bg-[var(--bg-subtle)] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{g.name}</span>
                    <StatusBadge
                      label={g.configured ? "Ativo" : "Aguardando credenciais"}
                      tone={g.configured ? "success" : "warning"}
                    />
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Webhook: {g.webhookPath}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <form
            onSubmit={handleRegisterPayment}
            className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-3"
          >
            <h2 className="font-display text-sm font-semibold">
              Registrar recebimento de cliente
            </h2>
            <Field label="Cliente">
              <Select
                value={payClientId}
                onChange={(e) => setPayClientId(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tipo">
                <Select
                  value={payKind}
                  onChange={(e) =>
                    setPayKind(e.target.value as "DEPOSIT" | "PARTIAL" | "FULL")
                  }
                >
                  <option value="DEPOSIT">Sinal de reserva</option>
                  <option value="PARTIAL">Pagamento parcial</option>
                  <option value="FULL">Pagamento integral</option>
                </Select>
              </Field>
              <Field label="Forma">
                <Select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Valor">
                <CurrencyInput
                  value={payAmount}
                  onValueChange={setPayAmount}
                  required
                />
              </Field>
              <Field label="Conta destino">
                <Select
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                >
                  {studioAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="submit" size="sm" disabled={saving || !payClientId}>
              Confirmar pagamento
            </Button>
          </form>
        </div>
      </div>

      {/* Equipe Futura (Somente Proprietária) */}
      {isOwner ? (
        <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4" strokeWidth={1.5} />
            Usuários e Permissões (Arquitetura multi-profissional)
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Colaboradores futuros nunca têm acesso ao módulo de finanças pessoais da proprietária.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ul className="divide-y divide-[var(--border-default)] border border-[var(--border-default)] rounded-[6px]">
              {staffUsers.map((u) => (
                <li
                  key={u.id}
                  className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-[var(--text-secondary)]">{u.email}</p>
                  </div>
                  <StatusBadge
                    label={u.role === "OWNER" ? "Proprietária" : "Equipe"}
                    tone={u.role === "OWNER" ? "success" : "info"}
                  />
                </li>
              ))}
            </ul>

            <form onSubmit={handleCreateStaff} className="space-y-2.5">
              <p className="text-xs font-semibold">Cadastrar novo profissional</p>
              <Input
                placeholder="Nome completo"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                required
              />
              <Input
                type="email"
                placeholder="E-mail"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Senha inicial (mínimo 8 caracteres)"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                required
              />
              <Button type="submit" size="sm" variant="secondary" disabled={saving}>
                Adicionar profissional
              </Button>
            </form>
          </div>
        </section>
      ) : null}

      {/* Auditoria e LGPD */}
      <section
        id="lgpd"
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
      >
        {isOwner ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
              Solicitações LGPD ({lgpdRequests.length})
            </h2>
            {lgpdRequests.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Nenhuma solicitação pendente ou registrada.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border-default)] text-xs">
                {lgpdRequests.map((r) => (
                  <li key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {r.clientName} — {r.type}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {formatDateTimeBR(r.requestedAt)}
                      </p>
                    </div>
                    {r.status === "PENDING" ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => processLgpd(r.id, "COMPLETED")}
                        >
                          Executar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => processLgpd(r.id, "REJECTED")}
                        >
                          Negar
                        </Button>
                      </div>
                    ) : (
                      <StatusBadge label={r.status} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-3">
          <h2 className="font-display text-sm font-semibold">
            Logs recentes de auditoria
          </h2>
          <ul className="divide-y divide-[var(--border-default)] text-xs max-h-64 overflow-y-auto">
            {auditLogs.map((l) => (
              <li key={l.id} className="py-2 flex items-center justify-between gap-2">
                <span>
                  <strong>{l.action}</strong> ({l.actorName})
                </span>
                <span className="tabular-nums text-[var(--text-secondary)]">
                  {formatDateTimeBR(l.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
