"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  X,
} from "lucide-react";
import {
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
  formatTimeBR,
} from "@/lib/format";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  PAYMENT_METHOD_LABELS,
} from "@/lib/domain-labels";
import {
  Button,
  EmptyState,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { STUDIO_OWNER_WHATSAPP } from "@/lib/pix";

type ClientAppt = {
  id: string;
  code: string;
  title: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: string;
  serviceId: string | null;
  serviceName: string | null;
  sessionNumber: number;
  totalSessions: number;
  recurrenceGroupId: string | null;
  priceEstimate: number | null;
  depositRequired: number | null;
  preferredPaymentMethod: string | null;
  clientNotes: string | null;
  projectName: string | null;
  confirmedAt: string | null;
  latestPayment: {
    amount: number;
    status: string;
    kind: string;
    method: string;
  } | null;
};

export function ClientAgendaClient({
  appointments,
}: {
  appointments: ClientAppt[];
}) {
  const router = useRouter();
  const [selectedAppt, setSelectedAppt] = useState<ClientAppt | null>(null);
  const [rescheduleAppt, setRescheduleAppt] = useState<ClientAppt | null>(null);
  const [note, setNote] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const now = new Date();
  const upcoming = appointments.filter(
    (a) =>
      new Date(a.startAt) >= now &&
      a.status !== "CANCELLED" &&
      a.status !== "NO_SHOW"
  );
  const past = appointments.filter((a) => !upcoming.some((u) => u.id === a.id));

  const pendingFollowUpSessions = appointments.filter((a) => {
    if (a.status !== "COMPLETED" || a.sessionNumber >= a.totalSessions) {
      return false;
    }
    const nextAlreadyScheduled = appointments.some(
      (other) =>
        other.id !== a.id &&
        other.status !== "CANCELLED" &&
        other.status !== "NO_SHOW" &&
        other.sessionNumber > a.sessionNumber &&
        ((a.serviceId && other.serviceId === a.serviceId) ||
          (a.recurrenceGroupId && other.recurrenceGroupId === a.recurrenceGroupId) ||
          other.title === a.title)
    );
    return !nextAlreadyScheduled;
  });

  const confirmPresence = async (id: string) => {
    setLoadingId(id);
    setFeedback(null);
    try {
      const res = await fetch("/api/client/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id, action: "confirm_presence" }),
      });
      if (res.ok) {
        setFeedback("Presença confirmada com sucesso.");
        setSelectedAppt(null);
        router.refresh();
      }
    } finally {
      setLoadingId(null);
    }
  };

  const submitReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleAppt) return;
    setLoadingId(rescheduleAppt.id);
    try {
      const res = await fetch("/api/client/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: rescheduleAppt.id,
          action: "request_reschedule",
          note,
        }),
      });
      if (res.ok) {
        setRescheduleAppt(null);
        setNote("");
        setFeedback(
          "Solicitação de reagendamento enviada. O estúdio confirmará a nova data."
        );
        router.refresh();
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Minha Agenda</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Acompanhe seus horários, confirme presença ou solicite reagendamento.
          </p>
        </div>
        <Link
          href="/agendar"
          className="h-10 px-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold self-start transition-all active:scale-[0.97]"
        >
          <Calendar className="h-3.5 w-3.5" strokeWidth={1.6} />
          Solicitar novo horário
        </Link>
      </div>

      {feedback ? (
        <div className="p-3 rounded-[6px] bg-[var(--status-success-bg)] text-[var(--status-success)] text-xs">
          {feedback}
        </div>
      ) : null}

      {pendingFollowUpSessions.length > 0 ? (
        <section className="space-y-2.5">
          {pendingFollowUpSessions.map((a) => {
            const nextSession = a.sessionNumber + 1;
            const serviceLabel = a.serviceName || a.title;
            return (
              <div
                key={`follow-${a.id}`}
                className="rounded-2xl border border-[var(--brand-champagne)]/45 bg-[var(--brand-champagne-subtle)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--brand-champagne)]">
                    Sessão {a.sessionNumber} de {a.totalSessions} concluída
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Falta agendar a Sessão {nextSession}/{a.totalSessions} — {serviceLabel}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Reserve o próximo horário para dar continuidade ao atendimento.
                  </p>
                </div>
                <Link
                  href="/agendar"
                  className="h-9 px-4 inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold shrink-0 transition-all active:scale-[0.97]"
                >
                  <Calendar className="h-3.5 w-3.5" strokeWidth={1.6} />
                  Agendar Sessão {nextSession}
                </Link>
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="space-y-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
          Próximas sessões ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-5 w-5" strokeWidth={1.5} />}
            title="Sem sessões futuras agendadas"
            description="Quando desejar marcar sua próxima tatuagem, solicite um horário online."
          />
        ) : (
          <div className="space-y-2.5">
            {upcoming.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAppt(a)}
                className="w-full text-left p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-all active:scale-[0.99] cursor-pointer space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] text-[var(--brand-champagne)]">
                        #{a.code}
                      </span>
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {a.serviceName || a.title}
                        {a.totalSessions > 1
                          ? ` • ${a.sessionNumber}/${a.totalSessions}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge
                      label={APPOINTMENT_STATUS_LABELS[a.status] || a.status}
                      tone={APPOINTMENT_STATUS_TONE[a.status] || "neutral"}
                    />
                    <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-default)] text-xs text-[var(--text-secondary)] tabular-nums">
                  <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                    <Clock className="h-3.5 w-3.5 text-[var(--brand-champagne)]" />
                    {formatDateBR(a.startAt)} • {formatTimeBR(a.startAt)} –{" "}
                    {formatTimeBR(a.endAt)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {a.preferredPaymentMethod ? (
                      <PaymentMethodIcon
                        method={a.preferredPaymentMethod}
                        size={13}
                      />
                    ) : null}
                    <span>
                      {a.latestPayment
                        ? formatBRL(a.latestPayment.amount)
                        : a.priceEstimate
                          ? formatBRL(a.priceEstimate)
                          : `${a.durationMinutes} min`}
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 ? (
        <section className="space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
            Histórico de atendimentos ({past.length})
          </h2>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl divide-y divide-[var(--border-default)] overflow-hidden">
            {past.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAppt(a)}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 text-xs hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold tabular-nums text-[var(--brand-champagne)]">
                      #{a.code}
                    </span>
                    <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                      {a.serviceName || a.title}
                    </p>
                  </div>
                  <p className="text-[var(--text-secondary)] tabular-nums mt-0.5">
                    {formatDateTimeBR(a.startAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusBadge
                    label={APPOINTMENT_STATUS_LABELS[a.status] || a.status}
                    tone={APPOINTMENT_STATUS_TONE[a.status] || "neutral"}
                  />
                  <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Modal de informações do agendamento */}
      {selectedAppt ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAppt(null);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <div className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 rounded-t-[28px] md:rounded-3xl p-5 space-y-4 overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] text-[var(--brand-champagne)]">
                    #{selectedAppt.code}
                  </span>
                  <StatusBadge
                    label={
                      APPOINTMENT_STATUS_LABELS[selectedAppt.status] ||
                      selectedAppt.status
                    }
                    tone={
                      APPOINTMENT_STATUS_TONE[selectedAppt.status] || "neutral"
                    }
                  />
                </div>
                <h3 className="font-display text-lg font-semibold text-[var(--text-primary)] truncate">
                  {selectedAppt.serviceName || selectedAppt.title}
                </h3>
                {selectedAppt.totalSessions > 1 ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Sessão {selectedAppt.sessionNumber} de{" "}
                    {selectedAppt.totalSessions}
                  </p>
                ) : null}
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
                <span className="text-[var(--text-secondary)]">Código</span>
                <span className="font-semibold tabular-nums text-[var(--brand-champagne)]">
                  #{selectedAppt.code}
                </span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">Data e hora</span>
                <span className="font-semibold tabular-nums text-right">
                  {formatDateBR(selectedAppt.startAt)} •{" "}
                  {formatTimeBR(selectedAppt.startAt)} –{" "}
                  {formatTimeBR(selectedAppt.endAt)} ({selectedAppt.durationMinutes}{" "}
                  min)
                </span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">Pagamento</span>
                <span className="font-semibold inline-flex items-center gap-1.5 tabular-nums">
                  {selectedAppt.preferredPaymentMethod ? (
                    <>
                      <PaymentMethodIcon
                        method={selectedAppt.preferredPaymentMethod}
                        size={14}
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
                    ? ` • ${formatBRL(selectedAppt.priceEstimate)}`
                    : ""}
                </span>
              </div>

              {selectedAppt.latestPayment ? (
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--text-secondary)]">
                    {selectedAppt.latestPayment.kind === "FULL"
                      ? "Valor pago (Total)"
                      : "Sinal"}
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--status-success)]">
                    {formatBRL(selectedAppt.latestPayment.amount)}{" "}
                    <span className="text-[11px] font-normal text-[var(--text-secondary)]">
                      (
                      {selectedAppt.latestPayment.status === "CONFIRMED"
                        ? "Confirmado"
                        : "Aguardando conferência"}
                      )
                    </span>
                  </span>
                </div>
              ) : null}

              {selectedAppt.projectName ? (
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--text-secondary)]">Projeto</span>
                  <span className="font-medium text-right">
                    {selectedAppt.projectName}
                  </span>
                </div>
              ) : null}
            </div>

            {selectedAppt.clientNotes ? (
              <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] p-3.5 text-xs">
                <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                  Suas observações
                </p>
                <p className="text-[var(--text-primary)] mt-1">
                  {selectedAppt.clientNotes}
                </p>
              </div>
            ) : null}

            <div className="space-y-2 pt-1">
              {selectedAppt.latestPayment?.method === "PIX" &&
              selectedAppt.latestPayment.status === "PENDING" ? (
                <a
                  href={`https://wa.me/${STUDIO_OWNER_WHATSAPP}?text=${encodeURIComponent(
                    `Olá Letícia! Segue o comprovante do Pix (${
                      selectedAppt.latestPayment.kind === "FULL"
                        ? "Valor total"
                        : "Sinal"
                    } ${formatBRL(
                      selectedAppt.latestPayment.amount
                    )}) referente ao agendamento #${selectedAppt.code} (${
                      selectedAppt.serviceName || selectedAppt.title
                    } • ${formatDateBR(selectedAppt.startAt)} às ${formatTimeBR(
                      selectedAppt.startAt
                    )}).`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full h-11 px-4 rounded-full bg-[#25D366] hover:bg-[#1EB958] text-[#062412] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <WhatsAppIcon size={17} />
                  Enviar comprovante no WhatsApp
                </a>
              ) : null}

              {selectedAppt.status === "AWAITING_CONFIRMATION" ||
              (selectedAppt.status === "CONFIRMED" &&
                !selectedAppt.confirmedAt) ? (
                <Button
                  className="w-full h-11 rounded-full"
                  onClick={() => confirmPresence(selectedAppt.id)}
                  disabled={loadingId === selectedAppt.id}
                >
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.6} />
                  Confirmar presença
                </Button>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`/api/client/appointments/${selectedAppt.id}/receipt`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 px-3 inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Comprovante PDF
                </a>

                {selectedAppt.status !== "COMPLETED" &&
                selectedAppt.status !== "CANCELLED" &&
                selectedAppt.status !== "NO_SHOW" ? (
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedAppt;
                      setSelectedAppt(null);
                      setRescheduleAppt(target);
                    }}
                    className="h-10 px-3 inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Reagendar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedAppt(null)}
                    className="h-10 px-3 inline-flex items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-xs font-medium text-[var(--text-primary)] cursor-pointer"
                  >
                    Fechar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rescheduleAppt ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setRescheduleAppt(null);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <form
            onSubmit={submitReschedule}
            className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 rounded-t-[28px] md:rounded-3xl p-5 space-y-4 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold text-[var(--brand-champagne)] tabular-nums">
                  Agendamento #{rescheduleAppt.code}
                </p>
                <h3 className="font-display text-base font-semibold">
                  Solicitar reagendamento
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleAppt(null)}
                aria-label="Fechar"
                className="h-8 w-8 rounded-full bg-[var(--bg-canvas)] text-[var(--text-secondary)] inline-flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Informe sua preferência de novas datas/horários (respeitando antecedência de 48h)."
              required
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRescheduleAppt(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={Boolean(loadingId)}>
                Enviar solicitação
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
