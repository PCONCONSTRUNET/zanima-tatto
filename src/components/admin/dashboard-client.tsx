"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarPlus,
  Check,
  CheckSquare,
  ChevronRight,
  Clock,
  Download,
  Plus,
  Receipt,
  Sparkles,
  Square,
  UserRound,
  X,
} from "lucide-react";
import {
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
  formatTimeBR,
  getGreetingBR,
} from "@/lib/format";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  PAYMENT_METHOD_LABELS,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_TONE,
} from "@/lib/domain-labels";
import { Button, Field, Input, StatusBadge } from "@/components/ui/primitives";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

interface DashboardAppointmentItem {
  id: string;
  title: string;
  serviceName: string | null;
  clientName: string;
  clientId: string;
  clientWhatsapp: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  sessionNumber: number;
  totalSessions: number;
  priceEstimate: number | null;
  depositRequired: number | null;
  preferredPaymentMethod: string | null;
  clientNotes: string | null;
  internalNotes: string | null;
  status: string;
}

interface DashboardProps {
  userName: string;
  hideValues: boolean;
  todayFormatted: string;
  todayStr: string;
  summary: {
    monthIncome: number;
    awaitingConfirmationCount: number;
    pendingQuotesCount: number;
  };
  todayAppointments: DashboardAppointmentItem[];
  upcomingAppointments: DashboardAppointmentItem[];
  pendingQuotes: Array<{
    id: string;
    title: string;
    clientId: string;
    clientName: string;
    style: string;
    status: string;
  }>;
  initialReminders: Array<{
    id: string;
    title: string;
    dueAt: string;
    completedAt: string | null;
  }>;
}

function formatWhatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const fullDigits = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${fullDigits}`;
}

function getNextStatusAction(status: string): {
  nextStatus: "CONFIRMED" | "IN_PROGRESS" | "COMPLETED";
  label: string;
} | null {
  if (
    status === "REQUESTED" ||
    status === "AWAITING_CONFIRMATION" ||
    status === "AWAITING_DEPOSIT"
  ) {
    return { nextStatus: "CONFIRMED", label: "Confirmar" };
  }
  if (status === "CONFIRMED") {
    return { nextStatus: "IN_PROGRESS", label: "Iniciar" };
  }
  if (status === "IN_PROGRESS") {
    return { nextStatus: "COMPLETED", label: "Concluir" };
  }
  return null;
}

export function DashboardClient({
  userName,
  hideValues,
  todayFormatted,
  todayStr,
  summary,
  todayAppointments: initialTodayAppointments,
  upcomingAppointments,
  pendingQuotes,
  initialReminders,
}: DashboardProps) {
  const router = useRouter();
  const [todayAppointments, setTodayAppointments] = useState(
    initialTodayAppointments
  );
  const [updatingApptId, setUpdatingApptId] = useState<string | null>(null);
  const [selectedAppt, setSelectedAppt] =
    useState<DashboardAppointmentItem | null>(null);
  const [reminders, setReminders] = useState(initialReminders);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [remTitle, setRemTitle] = useState("");
  const [remDate, setRemDate] = useState(todayStr);
  const [savingReminder, setSavingReminder] = useState(false);

  const firstName = userName.split(" ")[0] || userName;
  const greeting = getGreetingBR();

  const activeTodayCount = todayAppointments.filter(
    (a) => a.status !== "COMPLETED" && a.status !== "NO_SHOW"
  ).length;
  const pendingCount =
    summary.awaitingConfirmationCount + summary.pendingQuotesCount;

  const handleQuickStatus = async (
    id: string,
    nextStatus: "CONFIRMED" | "IN_PROGRESS" | "COMPLETED"
  ) => {
    setUpdatingApptId(id);
    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setTodayAppointments((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: nextStatus } : item
          )
        );
        router.refresh();
      }
    } finally {
      setUpdatingApptId(null);
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim()) return;
    setSavingReminder(true);
    try {
      const res = await fetch("/api/admin/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: remTitle, dueAt: remDate }),
      });
      if (res.ok) {
        const data = await res.json();
        setReminders((prev) => [data.reminder, ...prev]);
        setRemTitle("");
        setReminderModalOpen(false);
      }
    } finally {
      setSavingReminder(false);
    }
  };

  const toggleReminder = async (id: string, currentlyCompleted: boolean) => {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              completedAt: currentlyCompleted ? null : new Date().toISOString(),
            }
          : r
      )
    );
    await fetch("/api/admin/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed: !currentlyCompleted }),
    }).catch(() => {});
  };

  return (
    <div className="space-y-5">
      {/* Boas-vindas limpa + botão principal */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary)] capitalize">
            {todayFormatted}
          </p>
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] mt-0.5 truncate">
            {greeting}, {firstName}
          </h1>
        </div>

        <Link
          href="/admin/agenda?novo=1"
          className="shrink-0 h-10 px-4 inline-flex items-center gap-2 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold hover:bg-[var(--action-primary-hover)] transition-all active:scale-[0.97]"
        >
          <CalendarPlus className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          <span>Agendar</span>
        </Link>
      </div>

      {/* Resumo simples do dia em 3 cartões diretos */}
      <section
        aria-label="Resumo rápido"
        className="grid grid-cols-3 gap-2.5 sm:gap-3"
      >
        <Link
          href="/admin/agenda"
          className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-3.5 sm:p-4 hover:border-[var(--border-strong)] transition-colors"
        >
          <p className="text-[11px] text-[var(--text-secondary)] truncate">
            Hoje
          </p>
          <p className="font-display text-xl sm:text-2xl font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
            {todayAppointments.length}
          </p>
          <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
            {todayAppointments.length === 0
              ? "Dia livre"
              : `${activeTodayCount} em aberto`}
          </p>
        </Link>

        <Link
          href={
            summary.pendingQuotesCount > 0
              ? "/admin/orcamentos"
              : "/admin/agenda"
          }
          className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-3.5 sm:p-4 hover:border-[var(--border-strong)] transition-colors"
        >
          <p className="text-[11px] text-[var(--text-secondary)] truncate">
            Pendências
          </p>
          <p className="font-display text-xl sm:text-2xl font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
            {pendingCount}
          </p>
          <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
            {pendingCount === 0 ? "Tudo em dia" : "Para responder"}
          </p>
        </Link>

        <Link
          href="/admin/financeiro"
          className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-3.5 sm:p-4 hover:border-[var(--border-strong)] transition-colors"
        >
          <p className="text-[11px] text-[var(--text-secondary)] truncate">
            No mês
          </p>
          <p className="font-display text-base sm:text-2xl font-semibold text-[var(--text-primary)] tabular-nums mt-1 sm:mt-0.5 truncate">
            {formatBRL(summary.monthIncome, hideValues)}
          </p>
          <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
            Ver caixa
          </p>
        </Link>
      </section>

      {/* Bloco Principal: Atendimentos do Dia (limpo na tela, sem caixa externa apertando) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="h-4 w-4 text-[var(--brand-champagne)] shrink-0" strokeWidth={1.8} />
            <h2 className="font-display text-sm sm:text-base font-semibold text-[var(--text-primary)] truncate">
              Atendimentos de hoje
            </h2>
          </div>

          <Link
            href="/admin/agenda"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] shrink-0"
          >
            <span>Agenda</span>
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </Link>
        </div>

        {todayAppointments.length === 0 ? (
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] px-4 py-7 text-center space-y-3">
            <div className="mx-auto h-10 w-10 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-secondary)]">
              <Sparkles className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Nenhum atendimento para hoje
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Quando houver sessões marcadas para hoje, os clientes aparecem aqui.
              </p>
            </div>
            <Link
              href="/admin/agenda?novo=1"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span>Marcar horário</span>
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {todayAppointments.map((appt) => {
              const waHref = formatWhatsappHref(appt.clientWhatsapp);
              const nextAction = getNextStatusAction(appt.status);
              const isBusy = updatingApptId === appt.id;

              return (
                <li
                  key={appt.id}
                  onClick={() => setSelectedAppt(appt)}
                  className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--border-strong)] px-3.5 py-3 space-y-2.5 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="px-2.5 py-1 rounded-xl bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/30 text-center shrink-0">
                        <p className="text-xs font-semibold tabular-nums text-[var(--text-primary)] leading-tight">
                          {formatTimeBR(appt.startAt)}
                        </p>
                        <p className="text-[10px] tabular-nums text-[var(--text-secondary)] leading-tight mt-0.5">
                          {formatTimeBR(appt.endAt)}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {appt.clientName}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                          {appt.serviceName || appt.title}
                        </p>
                      </div>
                    </div>

                    <StatusBadge
                      label={
                        APPOINTMENT_STATUS_LABELS[appt.status] || appt.status
                      }
                      tone={APPOINTMENT_STATUS_TONE[appt.status] || "neutral"}
                    />
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 overflow-x-auto no-scrollbar"
                  >
                    {nextAction ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleQuickStatus(appt.id, nextAction.nextStatus)
                        }
                        className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold hover:bg-[var(--action-primary-hover)] disabled:opacity-50 cursor-pointer transition-all active:scale-[0.96] shrink-0"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2} />
                        <span>{isBusy ? "Atualizando..." : nextAction.label}</span>
                      </button>
                    ) : null}

                    {waHref ? (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
                      >
                        <WhatsAppIcon size={15} />
                        <span>WhatsApp</span>
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Próximos horários marcados */}
      {upcomingAppointments.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.6} />
              <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Próximos dias
              </h2>
            </div>
            <Link
              href="/admin/agenda"
              className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Ver agenda
            </Link>
          </div>
          <ul className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] divide-y divide-[var(--border-default)] overflow-hidden">
            {upcomingAppointments.map((item) => (
              <li
                key={item.id}
                onClick={() => setSelectedAppt(item)}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {item.clientName}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                    <span className="tabular-nums font-medium text-[var(--text-primary)]/80 mr-1.5">
                      {formatDateTimeBR(item.startAt)}
                    </span>
                    • {item.serviceName || item.title}
                  </p>
                </div>
                <StatusBadge
                  label={APPOINTMENT_STATUS_LABELS[item.status] || item.status}
                  tone={APPOINTMENT_STATUS_TONE[item.status] || "neutral"}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Pedidos & Lembretes rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.6} />
              <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Orçamentos novos ({pendingQuotes.length})
              </h2>
            </div>
            <Link
              href="/admin/orcamentos"
              className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Abrir
            </Link>
          </div>

          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] overflow-hidden">
            {pendingQuotes.length === 0 ? (
              <p className="px-4 py-4 text-xs text-[var(--text-secondary)]">
                Nenhum orçamento aguardando resposta.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border-default)]">
                {pendingQuotes.map((q) => (
                  <li
                    key={q.id}
                    className="px-4 py-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/clientes/${q.clientId}`}
                        className="text-xs font-semibold text-[var(--text-primary)] hover:underline truncate block"
                      >
                        {q.clientName}
                      </Link>
                      <p className="text-[11px] text-[var(--text-secondary)] truncate">
                        {q.title} • {q.style}
                      </p>
                    </div>
                    <StatusBadge
                      label={QUOTE_STATUS_LABELS[q.status] || q.status}
                      tone={QUOTE_STATUS_TONE[q.status] || "neutral"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Lembretes
              </h2>
              <Link
                href="/admin/lembretes"
                className="text-[11px] font-medium text-[var(--brand-champagne)] hover:underline"
              >
                Abrir notas e lembretes
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setReminderModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-primary)] hover:opacity-80 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Novo</span>
            </button>
          </div>

          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] overflow-hidden">
            {reminders.length === 0 ? (
              <p className="px-4 py-4 text-xs text-[var(--text-secondary)]">
                Nenhum lembrete anotado.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border-default)]">
                {reminders.map((rem) => {
                  const done = Boolean(rem.completedAt);
                  return (
                    <li
                      key={rem.id}
                      className="px-4 py-3 flex items-start gap-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => toggleReminder(rem.id, done)}
                        className="mt-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                        aria-label="Marcar lembrete como concluído"
                      >
                        {done ? (
                          <CheckSquare
                            className="h-4 w-4 text-[var(--status-success)]"
                            strokeWidth={1.6}
                          />
                        ) : (
                          <Square className="h-4 w-4" strokeWidth={1.6} />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-medium ${
                            done
                              ? "line-through text-[var(--text-muted)]"
                              : "text-[var(--text-primary)]"
                          }`}
                        >
                          {rem.title}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                          {formatDateBR(rem.dueAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Modal de Informações do Atendimento (Tela inteira no mobile, centrado no desktop) */}
      {selectedAppt ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAppt(null);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <div className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 rounded-t-[28px] md:rounded-3xl p-5 space-y-4 overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <StatusBadge
                  label={
                    APPOINTMENT_STATUS_LABELS[selectedAppt.status] ||
                    selectedAppt.status
                  }
                  tone={
                    APPOINTMENT_STATUS_TONE[selectedAppt.status] || "neutral"
                  }
                />
                <h3 className="font-display text-lg font-semibold mt-2 truncate">
                  {selectedAppt.clientName}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {selectedAppt.serviceName || selectedAppt.title}
                  {selectedAppt.totalSessions > 1
                    ? ` • Sessão ${selectedAppt.sessionNumber}/${selectedAppt.totalSessions}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAppt(null)}
                aria-label="Fechar"
                className="h-8 w-8 rounded-full bg-[var(--bg-canvas)] text-[var(--text-secondary)] inline-flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] divide-y divide-[var(--border-default)] text-xs">
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">Serviço</span>
                <span className="font-semibold text-right truncate max-w-[65%]">
                  {selectedAppt.serviceName || selectedAppt.title}
                  {selectedAppt.totalSessions > 1
                    ? ` (${selectedAppt.sessionNumber}/${selectedAppt.totalSessions})`
                    : ""}
                </span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">Data e hora</span>
                <span className="font-semibold tabular-nums text-right">
                  {formatDateBR(selectedAppt.startAt)} •{" "}
                  {formatTimeBR(selectedAppt.startAt)} –{" "}
                  {formatTimeBR(selectedAppt.endAt)} ({selectedAppt.durationMinutes} min)
                </span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">WhatsApp</span>
                <span className="font-medium tabular-nums">
                  {selectedAppt.clientWhatsapp}
                </span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">Pagamento</span>
                <span className="font-semibold inline-flex items-center gap-1.5 tabular-nums">
                  {selectedAppt.preferredPaymentMethod ? (
                    <>
                      <PaymentMethodIcon
                        method={selectedAppt.preferredPaymentMethod}
                        size={15}
                      />
                      <span>
                        {PAYMENT_METHOD_LABELS[
                          selectedAppt.preferredPaymentMethod
                        ] || selectedAppt.preferredPaymentMethod}
                      </span>
                    </>
                  ) : (
                    <span>A definir</span>
                  )}
                  {selectedAppt.priceEstimate !== null
                    ? ` • ${formatBRL(selectedAppt.priceEstimate, hideValues)}`
                    : ""}
                </span>
              </div>

              {selectedAppt.depositRequired ? (
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--text-secondary)]">Sinal</span>
                  <span className="font-semibold tabular-nums">
                    {formatBRL(selectedAppt.depositRequired, hideValues)}
                  </span>
                </div>
              ) : null}
            </div>

            {selectedAppt.clientNotes || selectedAppt.internalNotes ? (
              <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] p-4 space-y-2 text-xs">
                {selectedAppt.clientNotes ? (
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                      Observações da cliente
                    </p>
                    <p className="text-[var(--text-primary)] mt-0.5">
                      {selectedAppt.clientNotes}
                    </p>
                  </div>
                ) : null}
                {selectedAppt.internalNotes ? (
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                      Anotações internas
                    </p>
                    <p className="text-[var(--text-primary)] mt-0.5">
                      {selectedAppt.internalNotes}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              {(() => {
                const act = getNextStatusAction(selectedAppt.status);
                if (!act) return null;
                return (
                  <button
                    type="button"
                    disabled={updatingApptId === selectedAppt.id}
                    onClick={async () => {
                      await handleQuickStatus(selectedAppt.id, act.nextStatus);
                      setSelectedAppt((prev) =>
                        prev ? { ...prev, status: act.nextStatus } : null
                      );
                    }}
                    className="h-10 px-4 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>{act.label}</span>
                  </button>
                );
              })()}

              {formatWhatsappHref(selectedAppt.clientWhatsapp) ? (
                <a
                  href={formatWhatsappHref(selectedAppt.clientWhatsapp)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 px-4 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5"
                >
                  <WhatsAppIcon size={15} />
                  <span>WhatsApp</span>
                </a>
              ) : null}

              <a
                href={`/api/admin/appointments/${selectedAppt.id}/receipt`}
                target="_blank"
                rel="noreferrer"
                className="h-10 px-4 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Comprovante PDF</span>
              </a>

              <Link
                href={`/admin/clientes/${selectedAppt.clientId}`}
                className="h-10 px-4 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5"
              >
                <UserRound className="h-3.5 w-3.5" />
                <span>Ficha da cliente</span>
              </Link>

              <Link
                href="/admin/agenda"
                className="h-10 px-4 rounded-full border border-[var(--border-default)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Abrir na Agenda</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal simples de Lembrete (Tela inteira no mobile, centrado no desktop) */}
      {reminderModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4">
          <form
            onSubmit={handleAddReminder}
            className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 rounded-t-[28px] md:rounded-3xl p-5 space-y-4 overflow-y-auto shadow-2xl"
          >
            <div className="space-y-4">
              <h3 className="font-display text-base font-semibold">
                Novo lembrete
              </h3>
              <Field label="O que precisa lembrar?">
                <Input
                  value={remTitle}
                  onChange={(e) => setRemTitle(e.target.value)}
                  placeholder="Ex: Confirmar horário da Ana ou comprar biqueiras"
                  required
                />
              </Field>
              <Field label="Data">
                <Input
                  type="date"
                  value={remDate}
                  onChange={(e) => setRemDate(e.target.value)}
                  required
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReminderModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingReminder}>
                {savingReminder ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
