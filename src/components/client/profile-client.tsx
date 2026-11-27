"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Save, ShieldAlert } from "lucide-react";
import { TATTOO_STYLES } from "@/lib/domain-labels";
import {
  ConfirmModal,
  Field,
  Input,
} from "@/components/ui/primitives";

export function ClientProfileClient({
  initial,
}: {
  initial: {
    fullName: string;
    email: string;
    whatsapp: string;
    phone: string;
    birthDate: string;
    preferredStyles: string[];
    marketingOptIn: boolean;
  };
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [phone, setPhone] = useState(initial.phone);
  const [birthDate, setBirthDate] = useState(initial.birthDate);
  const [preferredStyles, setPreferredStyles] = useState(
    initial.preferredStyles
  );
  const [marketingOptIn, setMarketingOptIn] = useState(initial.marketingOptIn);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmAnon, setConfirmAnon] = useState(false);

  const initials = (fullName || initial.fullName)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  const toggleStyle = (style: string) => {
    setPreferredStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          whatsapp,
          phone,
          birthDate,
          preferredStyles,
          marketingOptIn,
        }),
      });
      if (res.ok) {
        setMessage("Perfil atualizado com sucesso.");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExportLgpd = async () => {
    const res = await fetch("/api/client/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "export_data" }),
    });
    if (res.ok) {
      const payload = await res.json();
      const blob = new Blob([JSON.stringify(payload.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meus-dados-zanima-lgpd.json";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleRequestAnonymization = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/client/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_anonymization" }),
      });
      if (res.ok) {
        setConfirmAnon(false);
        setMessage(
          "Solicitação de anonimização LGPD registrada e encaminhada à administração."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Cabeçalho compacto com avatar e e-mail */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 flex items-center gap-3.5">
        <div className="h-11 w-11 rounded-full bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/35 text-[var(--brand-champagne)] font-display text-sm font-semibold flex items-center justify-center shrink-0">
          {initials || "ZT"}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-base font-semibold truncate">
            {fullName || "Meu Perfil"}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] truncate">
            {initial.email}
          </p>
        </div>
      </div>

      {message ? (
        <div className="p-3 rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success)] text-xs font-medium">
          {message}
        </div>
      ) : null}

      <form
        onSubmit={handleSave}
        className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 sm:p-5 space-y-3.5"
      >
        <Field label="Nome completo">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-xl"
            required
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="WhatsApp">
            <Input
              type="tel"
              inputMode="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="rounded-xl"
              required
            />
          </Field>
          <Field label="Telefone">
            <Input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-xl"
            />
          </Field>
        </div>

        <Field label="Data de nascimento">
          <Input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="rounded-xl"
          />
        </Field>

        <Field label="Estilos preferidos">
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {TATTOO_STYLES.map((style) => {
              const selected = preferredStyles.includes(style);
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => toggleStyle(style)}
                  className={`h-8 px-3.5 rounded-full text-xs font-medium border transition-all active:scale-[0.95] cursor-pointer ${
                    selected
                      ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                      : "bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-default)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {style}
                </button>
              );
            })}
          </div>
        </Field>

        <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] cursor-pointer">
          <span className="text-xs text-[var(--text-secondary)] leading-snug">
            Receber novidades de agenda aberta e condições especiais
          </span>
          <span className="relative inline-flex shrink-0 items-center">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="sr-only peer"
            />
            <span className="w-10 h-6 rounded-full bg-[var(--border-strong)] peer-checked:bg-[var(--status-success)] transition-colors" />
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="h-11 w-full rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
        >
          <Save className="h-4 w-4" strokeWidth={1.75} />
          {saving ? "Salvando..." : "Salvar perfil"}
        </button>
      </form>

      <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="space-y-0.5">
          <h2 className="font-display text-sm font-semibold">
            Privacidade e LGPD
          </h2>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Exporte seus dados ou solicite anonimização do cadastro a qualquer momento.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleExportLgpd}
            className="h-10 px-4 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.6} />
            Exportar dados (JSON)
          </button>
          <button
            type="button"
            onClick={() => setConfirmAnon(true)}
            className="h-10 px-4 rounded-full border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] text-xs font-medium text-[var(--status-danger)] inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer"
          >
            <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.6} />
            Solicitar exclusão
          </button>
        </div>
      </section>

      <ConfirmModal
        open={confirmAnon}
        title="Solicitar anonimização LGPD"
        description="A administração será notificada para processar a exclusão ou anonimização dos seus dados pessoais, preservando apenas obrigações legais."
        confirmLabel="Confirmar solicitação"
        loading={saving}
        onConfirm={handleRequestAnonymization}
        onCancel={() => setConfirmAnon(false)}
      />
    </div>
  );
}
