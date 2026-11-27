"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  CheckCircle2,
  Megaphone,
  Save,
  Send,
  Settings2,
  Shield,
  Users,
  X,
} from "lucide-react";
import {
  Button,
  Field,
  Input,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";
import { PushOptInButton } from "@/components/ui/push-opt-in-button";
import {
  PUSH_RULE_CATALOG,
  type PushEventRuleKey,
  type PushRuleToggle,
} from "@/lib/push-config";
import { formatDateTimeBR } from "@/lib/format";

interface PushConfigView {
  globalEnabled: boolean;
  adminEnabled: boolean;
  clientEnabled: boolean;
  appId: string;
  safariWebId: string;
  hasRestApiKey: boolean;
  restApiKeyHint: string | null;
  configuredViaEnv: boolean;
  rules: Record<PushEventRuleKey, PushRuleToggle>;
}

interface CampaignItem {
  id: string;
  title: string;
  segment: string;
  message: string;
  targetCount: number;
  status: string;
  createdAt: string;
}

function TogglePill({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`h-8 px-3 rounded-full border text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-45 ${
        checked
          ? "bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success)]/35"
          : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)]"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          checked ? "bg-[var(--status-success)]" : "bg-[var(--text-muted)]"
        }`}
      />
      <span>{label}: {checked ? "Ativo" : "Desligado"}</span>
    </button>
  );
}

export function PushAdminClient({
  currentUser,
  initialConfig,
  initialCampaigns,
  counts,
}: {
  currentUser: { id: string; role: string };
  initialConfig: PushConfigView;
  initialCampaigns: CampaignItem[];
  counts: { activeClients: number; activeAdmins: number };
}) {
  const router = useRouter();
  const [config, setConfig] = useState<PushConfigView>(initialConfig);
  const [restApiKeyInput, setRestApiKeyInput] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastLink, setBroadcastLink] = useState("/agendar");
  const [broadcastTarget, setBroadcastTarget] = useState<
    "ALL" | "CLIENTS" | "ADMINS"
  >("ALL");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const saveSettings = async (nextConfig: PushConfigView = config) => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/push", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          globalEnabled: nextConfig.globalEnabled,
          adminEnabled: nextConfig.adminEnabled,
          clientEnabled: nextConfig.clientEnabled,
          appId: nextConfig.appId,
          safariWebId: nextConfig.safariWebId,
          restApiKey: restApiKeyInput.trim() || undefined,
          rules: nextConfig.rules,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Erro ao salvar configurações.",
        });
        return;
      }
      setConfig(data.config);
      setRestApiKeyInput("");
      setFeedback({
        type: "success",
        text: "Configurações de notificações Push salvas com sucesso.",
      });
      router.refresh();
    } catch {
      setFeedback({ type: "error", text: "Falha de conexão ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSelf = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_self" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Não foi possível enviar o teste.",
        });
        return;
      }
      setFeedback({
        type: "success",
        text: "Push de teste enviado ao OneSignal para sua conta Admin!",
      });
    } catch {
      setFeedback({ type: "error", text: "Erro ao disparar teste." });
    } finally {
      setTesting(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingBroadcast(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "broadcast",
          title: broadcastTitle,
          body: broadcastBody,
          linkUrl: broadcastLink || "/",
          target: broadcastTarget,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Não foi possível enviar a notificação manual.",
        });
        return;
      }
      setBroadcastOpen(false);
      setBroadcastTitle("");
      setBroadcastBody("");
      setFeedback({
        type: "success",
        text: `Notificação manual enviada! (${data.inAppCount} conta(s) registrada(s) + disparo OneSignal).`,
      });
      router.refresh();
    } catch {
      setFeedback({ type: "error", text: "Erro de conexão no envio manual." });
    } finally {
      setSendingBroadcast(false);
    }
  };

  const updateRule = (
    key: PushEventRuleKey,
    side: "client" | "admin",
    value: boolean
  ) => {
    setConfig((prev) => ({
      ...prev,
      rules: {
        ...prev.rules,
        [key]: {
          ...prev.rules[key],
          [side]: value,
        },
      },
    }));
  };

  const isOneSignalReady = Boolean(config.appId && config.hasRestApiKey);

  return (
    <div className="space-y-6">
      {/* Cabeçalho + CTA Manual */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-champagne)]">
            OneSignal Web Push
          </p>
          <h1 className="font-display text-2xl font-semibold">
            Notificações Push
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Ative ou desative alertas Push para Admin e Clientes e envie campanhas manuais para todos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => setBroadcastOpen(true)}
          >
            <Megaphone className="h-4 w-4" strokeWidth={1.75} />
            Enviar notificação manual
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => saveSettings()}
          >
            <Save className="h-4 w-4" strokeWidth={1.6} />
            {saving ? "Salvando..." : "Salvar regras"}
          </Button>
        </div>
      </div>

      {feedback ? (
        <div
          className={`px-4 py-3 rounded-2xl text-xs font-medium flex items-center justify-between gap-2 ${
            feedback.type === "success"
              ? "bg-[var(--status-success-bg)] text-[var(--status-success)]"
              : "bg-[var(--status-danger-bg)] text-[var(--status-danger)]"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      ) : null}

      {/* Status OneSignal + Ativação neste Aparelho */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/35 flex items-center justify-center text-[var(--brand-champagne)] shrink-0">
              <BellRing className="h-5 w-5" strokeWidth={1.7} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-sm font-semibold">
                  Integração OneSignal
                </h2>
                <StatusBadge
                  label={isOneSignalReady ? "Conectado" : "Pendente"}
                  tone={isOneSignalReady ? "success" : "warning"}
                />
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                App ID:{" "}
                <span className="font-mono text-[11px] text-[var(--text-primary)]">
                  {config.appId || "Não definido"}
                </span>{" "}
                • Chave REST:{" "}
                <span className="font-mono text-[11px]">
                  {config.restApiKeyHint || "Ausente"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={testing || !isOneSignalReady}
              onClick={handleTestSelf}
            >
              <Send className="h-3.5 w-3.5" />
              {testing ? "Enviando..." : "Testar Push"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowCredentials((v) => !v)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {showCredentials ? "Ocultar chaves" : "Credenciais"}
            </Button>
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-[var(--text-secondary)]">
            <p className="font-medium text-[var(--text-primary)]">
              Ativar ou desativar Push neste aparelho (Admin)
            </p>
            <p>
              Receba avisos instantâneos quando clientes agendarem, confirmarem Pix, faltarem ou cancelarem.
            </p>
          </div>
          <PushOptInButton
            userId={currentUser.id}
            role={currentUser.role}
          />
        </div>

        {showCredentials ? (
          <div className="pt-3 border-t border-[var(--border-default)] grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="OneSignal App ID">
              <Input
                value={config.appId}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, appId: e.target.value }))
                }
                placeholder="uuid do aplicativo OneSignal"
              />
            </Field>
            <Field label="Safari Web ID (opcional)">
              <Input
                value={config.safariWebId}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, safariWebId: e.target.value }))
                }
                placeholder="web.onesignal.auto..."
              />
            </Field>
            <Field label="Nova REST API Key (opcional)">
              <Input
                type="password"
                value={restApiKeyInput}
                onChange={(e) => setRestApiKeyInput(e.target.value)}
                placeholder={
                  config.hasRestApiKey
                    ? "Deixe vazio para manter a chave atual"
                    : "Cole sua OneSignal REST API Key"
                }
              />
            </Field>
          </div>
        ) : null}
      </div>

      {/* Controles Gerais Admin / Cliente */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              Sistema Push Geral
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Chave mestre de envios Push
            </p>
          </div>
          <TogglePill
            checked={config.globalEnabled}
            onChange={(v) => setConfig((p) => ({ ...p, globalEnabled: v }))}
            label="Geral"
          />
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-[var(--brand-champagne)]" />
              Push para Admin ({counts.activeAdmins})
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Alertas no app administrativo
            </p>
          </div>
          <TogglePill
            checked={config.adminEnabled}
            disabled={!config.globalEnabled}
            onChange={(v) => setConfig((p) => ({ ...p, adminEnabled: v }))}
            label="Admin"
          />
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[var(--brand-champagne)]" />
              Push para Clientes ({counts.activeClients})
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Alertas automáticos para clientes
            </p>
          </div>
          <TogglePill
            checked={config.clientEnabled}
            disabled={!config.globalEnabled}
            onChange={(v) => setConfig((p) => ({ ...p, clientEnabled: v }))}
            label="Clientes"
          />
        </div>
      </div>

      {/* Regras Automáticas */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold">
              Gatilhos Automáticos por Evento
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Escolha quais eventos disparam Push para o Cliente e/ou para o Administrador.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={saving}
            onClick={() => saveSettings()}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>

        <div className="divide-y divide-[var(--border-default)] rounded-2xl border border-[var(--border-default)] overflow-hidden">
          {PUSH_RULE_CATALOG.map((item) => {
            const ruleVal = config.rules[item.key];
            return (
              <div
                key={item.key}
                className="p-4 bg-[var(--bg-surface)] flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {item.title}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {item.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <TogglePill
                    checked={ruleVal.client}
                    disabled={!config.globalEnabled || !config.clientEnabled}
                    onChange={(v) => updateRule(item.key, "client", v)}
                    label="Cliente"
                  />
                  <TogglePill
                    checked={ruleVal.admin}
                    disabled={!config.globalEnabled || !config.adminEnabled}
                    onChange={(v) => updateRule(item.key, "admin", v)}
                    label="Admin"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Histórico de Notificações Manuais */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold">
            Histórico de Notificações Manuais
          </h2>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setBroadcastOpen(true)}
          >
            <Megaphone className="h-3.5 w-3.5" />
            Nova notificação
          </Button>
        </div>

        {initialCampaigns.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-4 text-center">
            Nenhuma notificação manual enviada ainda. Use o botão acima para divulgar promoções ou avisos.
          </p>
        ) : (
          <div className="space-y-2">
            {initialCampaigns.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {c.title}
                    </span>
                    <StatusBadge
                      label={c.status === "SENT" ? "Enviado" : "Falha"}
                      tone={c.status === "SENT" ? "success" : "danger"}
                    />
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-medium">
                      {c.segment === "ALL"
                        ? "Todos"
                        : c.segment === "CLIENTS"
                          ? "Clientes"
                          : "Admin"}
                    </span>
                  </div>
                  <p className="text-[var(--text-secondary)]">{c.message}</p>
                </div>
                <div className="text-[11px] text-[var(--text-muted)] shrink-0 tabular-nums">
                  {formatDateTimeBR(c.createdAt)} • {c.targetCount} conta(s)
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Disparo Manual (Promoção / Aviso para Todos) */}
      {broadcastOpen ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setBroadcastOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <form
            onSubmit={handleSendBroadcast}
            className="w-full max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)] rounded-t-[28px] md:rounded-3xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-champagne)]">
                  Envio Manual Push
                </p>
                <h3 className="font-display text-base font-semibold">
                  Enviar notificação para todos
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBroadcastOpen(false)}
                className="h-8 w-8 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] inline-flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <Field label="Público de destino">
              <Select
                value={broadcastTarget}
                onChange={(e) =>
                  setBroadcastTarget(
                    e.target.value as "ALL" | "CLIENTS" | "ADMINS"
                  )
                }
              >
                <option value="ALL">
                  Todos os inscritos (Clientes + Estúdio)
                </option>
                <option value="CLIENTS">
                  Somente Clientes cadastrados ({counts.activeClients})
                </option>
                <option value="ADMINS">
                  Somente Administradores ({counts.activeAdmins})
                </option>
              </Select>
            </Field>

            <Field label="Título da notificação">
              <Input
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="Ex: Promoção hoje no estúdio ZANIMA!"
                required
              />
            </Field>

            <Field label="Mensagem">
              <Textarea
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                placeholder="Ex: Horários livres hoje com condição especial em Fine Line. Reserve pelo app!"
                required
              />
            </Field>

            <Field
              label="Link ao abrir a notificação (opcional)"
              hint="Ex: /agendar, /desenhos-disponiveis ou /minha-conta"
            >
              <Input
                value={broadcastLink}
                onChange={(e) => setBroadcastLink(e.target.value)}
                placeholder="/agendar"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setBroadcastOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={sendingBroadcast}>
                <Send className="h-3.5 w-3.5" />
                {sendingBroadcast ? "Enviando..." : "Enviar Push agora"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
