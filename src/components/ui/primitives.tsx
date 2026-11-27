"use client";

import React from "react";
import type { StatusTone } from "@/lib/domain-labels";
import {
  digitsToCanonicalCurrency,
  formatCepBR,
  formatCpfCnpjBR,
  formatCurrencyDisplayBR,
  formatDecimalDisplayBR,
  formatPhoneBR,
  parseDecimalInputBR,
} from "@/lib/format";

const TONE_MAP: Record<StatusTone, string> = {
  neutral:
    "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)]",
  success:
    "bg-[var(--status-success-bg)] text-[var(--status-success)] border-transparent",
  warning:
    "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-transparent",
  danger:
    "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-transparent",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)] border-transparent",
};

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StatusTone;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-[4px] border whitespace-nowrap ${TONE_MAP[tone]}`}
    >
      {label}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all active:scale-[0.97] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action-primary)]";
  const sizes =
    size === "sm" ? "h-9 px-3 text-xs" : "h-11 md:h-10 px-4 text-sm";
  const variants = {
    primary:
      "bg-[var(--action-primary)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)]",
    secondary:
      "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-subtle)]",
    ghost:
      "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]",
    danger:
      "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border border-[var(--status-danger)]/20 hover:opacity-90",
  };

  return (
    <button
      className={`${base} ${sizes} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export type InputMask =
  | "phone"
  | "cpf"
  | "cpfCnpj"
  | "cep"
  | "digits"
  | "none";

function applyInputMask(mask: InputMask, raw: string): string {
  if (mask === "phone") return formatPhoneBR(raw);
  if (mask === "cpf") return formatCpfCnpjBR(raw).slice(0, 14);
  if (mask === "cpfCnpj") return formatCpfCnpjBR(raw);
  if (mask === "cep") return formatCepBR(raw);
  if (mask === "digits") return raw.replace(/\D/g, "");
  return raw;
}

export function Input({
  className = "",
  mask,
  type,
  value,
  onChange,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  mask?: InputMask;
}) {
  const effectiveMask: InputMask =
    mask ?? (type === "tel" ? "phone" : "none");

  const displayValue =
    effectiveMask !== "none" && typeof value === "string"
      ? applyInputMask(effectiveMask, value)
      : value;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (effectiveMask !== "none") {
      e.target.value = applyInputMask(effectiveMask, e.target.value);
    }
    onChange?.(e);
  };

  return (
    <input
      type={type}
      value={displayValue}
      onChange={handleChange}
      className={`w-full h-11 md:h-10 px-3 text-sm bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-[var(--border-default)] rounded-[6px] focus:outline-none focus:border-[var(--action-primary)] transition-colors ${className}`}
      {...props}
    />
  );
}

export function CurrencyInput({
  value,
  onValueChange,
  className = "",
  prefix = "R$",
  placeholder = "0,00",
  ...props
}: Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: string | number | undefined | null;
  onValueChange: (canonicalValue: string) => void;
  prefix?: string;
}) {
  const display = formatCurrencyDisplayBR(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const canonical = digitsToCanonicalCurrency(e.target.value);
    onValueChange(canonical);
  };

  return (
    <div className="relative flex items-center">
      {prefix ? (
        <span className="pointer-events-none absolute left-3 text-xs font-medium text-[var(--text-secondary)] select-none">
          {prefix}
        </span>
      ) : null}
      <input
        type="text"
        inputMode="numeric"
        value={display}
        placeholder={placeholder}
        onChange={handleChange}
        className={`w-full h-11 md:h-10 ${
          prefix ? "pl-9" : "px-3"
        } pr-3 text-sm tabular-nums bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-[var(--border-default)] rounded-[6px] focus:outline-none focus:border-[var(--action-primary)] transition-colors ${className}`}
        {...props}
      />
    </div>
  );
}

export function DecimalInput({
  value,
  onValueChange,
  className = "",
  placeholder = "0",
  ...props
}: Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: string | number | undefined | null;
  onValueChange: (canonicalValue: string) => void;
}) {
  const display = formatDecimalDisplayBR(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const canonical = parseDecimalInputBR(e.target.value);
    onValueChange(canonical);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder}
      onChange={handleChange}
      className={`w-full h-11 md:h-10 px-3 text-sm tabular-nums bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-[var(--border-default)] rounded-[6px] focus:outline-none focus:border-[var(--action-primary)] transition-colors ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full h-11 md:h-10 px-3 text-sm bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-[6px] focus:outline-none focus:border-[var(--action-primary)] transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full p-3 text-sm bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-[var(--border-default)] rounded-[6px] focus:outline-none focus:border-[var(--action-primary)] transition-colors min-h-[96px] ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[var(--text-primary)]">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-[11px] text-[var(--text-secondary)]">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-[11px] text-[var(--status-danger)]">{error}</p>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] rounded-3xl px-5 py-10 text-center">
      {icon ? (
        <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-md mx-auto">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/55 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-t-[26px] md:rounded-3xl p-5 pt-3 md:pt-5 space-y-4 shadow-2xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-[var(--border-strong)] md:hidden" />
        <div className="space-y-1.5">
          <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
            {title}
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">{description}</p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processando..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
