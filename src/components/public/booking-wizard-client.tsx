"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Sparkles,
  Wallet,
} from "lucide-react";
import { BrandLogo, PconSignature } from "@/components/brand-mark";
import { EmptyState, Field, Input } from "@/components/ui/primitives";
import { IosDatePicker } from "@/components/ui/ios-date-picker";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { formatBRL, formatSequentialCode, toISODateSP } from "@/lib/format";
import {
  buildPixPayload,
  buildPixReceiptWhatsappUrl,
  DEFAULT_DEPOSIT_AMOUNT,
  STUDIO_OWNER_WHATSAPP,
  STUDIO_PIX_KEY,
} from "@/lib/pix";

export type PublicServiceItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  sessionsCount: number;
  price: number;
  depositAmount: number;
};

type Slot = { startTime: string; endTime: string; available: boolean };

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function createUnlockedAudioContext(): AudioContext | null {
  try {
    const w = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctx = w.AudioContext || w.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

function playBookingSuccessChime(audioCtx: AudioContext | null) {
  try {
    const ctx = audioCtx || createUnlockedAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const notes = [1046.5, 1318.51, 1567.98];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.085);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.085);
      gain.gain.exponentialRampToValueAtTime(0.16, now + idx * 0.085 + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + idx * 0.085 + (idx === notes.length - 1 ? 0.42 : 0.22)
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.085);
      osc.stop(now + idx * 0.085 + 0.45);
    });
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 900);
  } catch {
    // Silencioso caso navegador bloqueie áudio
  }
}

export function BookingWizardClient({
  services,
  studioWhatsapp = STUDIO_OWNER_WHATSAPP,
  pixKey = STUDIO_PIX_KEY,
  prefillClient,
}: {
  services: PublicServiceItem[];
  studioWhatsapp?: string;
  pixKey?: string;
  prefillClient: {
    isLoggedIn: boolean;
    fullName: string;
    whatsapp: string;
    email: string;
  };
}) {
  const hasServices = services.length > 0;
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [stepMotion, setStepMotion] = useState<{
    dir: "forward" | "back";
    leaving: boolean;
  }>({ dir: "forward", leaving: false });
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, []);

  const goToStep = (nextStep: 1 | 2 | 3 | 4) => {
    if (nextStep === step && !stepMotion.leaving) return;
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    const dir = nextStep >= step ? "forward" : "back";
    setHasNavigated(true);
    setStepMotion({ dir, leaving: true });
    stepTimerRef.current = setTimeout(() => {
      setStep(nextStep);
      setStepMotion({ dir, leaving: false });
      stepTimerRef.current = null;
    }, 260);
  };

  const stepCardClass = stepMotion.leaving
    ? stepMotion.dir === "forward"
      ? "ios-step-exit-forward"
      : "ios-step-exit-back"
    : !hasNavigated
      ? "ios-page-enter"
      : stepMotion.dir === "forward"
        ? "ios-step-enter-forward"
        : "ios-step-enter-back";

  const [activeCategory, setActiveCategory] = useState("TODAS");
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    services[0]?.id ?? ""
  );

  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const [paymentChoice, setPaymentChoice] = useState<"DEPOSIT" | "FULL">(
    "DEPOSIT"
  );
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copiedTarget, setCopiedTarget] = useState<"code" | "key" | null>(null);
  const [clientNotes, setClientNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedData, setConfirmedData] = useState<{
    appointmentId: string;
    appointmentCode: string;
    paidAmount: number;
    paymentChoice: "DEPOSIT" | "FULL";
  } | null>(null);

  const categories = useMemo(() => {
    const set = Array.from(
      new Set(services.map((s) => s.category.trim()).filter(Boolean))
    );
    return ["TODAS", ...set];
  }, [services]);

  const filteredServices = useMemo(() => {
    if (activeCategory === "TODAS") return services;
    return services.filter((s) => s.category.trim() === activeCategory);
  }, [services, activeCategory]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId]
  );

  const effectiveDuration = selectedService?.durationMinutes ?? 120;
  const requestKey = `${date}:${effectiveDuration}`;
  const loadingSlots = Boolean(date) && loadedKey !== requestKey;

  useEffect(() => {
    if (!hasServices || !date) return;
    let active = true;
    fetch(`/api/admin/availability?date=${date}&duration=${effectiveDuration}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setSlots(Array.isArray(data.slots) ? data.slots : []);
        setSelectedTime("");
        setLoadedKey(`${date}:${effectiveDuration}`);
      })
      .catch(() => {
        if (active) {
          setSlots([]);
          setLoadedKey(`${date}:${effectiveDuration}`);
        }
      });
    return () => {
      active = false;
    };
  }, [date, effectiveDuration, hasServices]);

  const availableSlots = slots.filter((s) => s.available);

  const depositAmount =
    selectedService && selectedService.depositAmount > 0
      ? selectedService.depositAmount
      : DEFAULT_DEPOSIT_AMOUNT;

  const hasFullOption = Boolean(
    selectedService &&
      selectedService.price > 0 &&
      selectedService.price !== depositAmount
  );

  const effectivePaymentChoice: "DEPOSIT" | "FULL" =
    paymentChoice === "FULL" && hasFullOption ? "FULL" : "DEPOSIT";

  const amountToPay =
    effectivePaymentChoice === "FULL" && selectedService
      ? selectedService.price
      : depositAmount;

  const pixTxid = useMemo(() => {
    const raw = `${date.replace(/\D/g, "")}${selectedTime.replace(/\D/g, "")}${selectedServiceId.slice(-6)}`;
    const clean = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return `ZNM${clean || "STUDIO"}`.slice(0, 20);
  }, [selectedServiceId, date, selectedTime]);

  const pixPayload = useMemo(
    () =>
      buildPixPayload({
        pixKey,
        amount: amountToPay,
        txid: pixTxid,
      }),
    [pixKey, amountToPay, pixTxid]
  );

  useEffect(() => {
    if (step !== 4 || !pixPayload) return;
    let active = true;
    QRCode.toDataURL(pixPayload, {
      width: 280,
      margin: 2,
      color: {
        dark: "#111111",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [step, pixPayload]);

  const copyToClipboard = async (text: string, target: "code" | "key") => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedTarget(target);
    window.setTimeout(() => {
      setCopiedTarget((curr) => (curr === target ? null : curr));
    }, 2400);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedService) {
      setError("Selecione um serviço.");
      goToStep(1);
      return;
    }
    if (!selectedTime) {
      setError("Selecione um horário disponível.");
      goToStep(2);
      return;
    }
    if (!prefillClient.isLoggedIn) {
      setError("Entre na sua conta para confirmar o agendamento.");
      return;
    }

    setSaving(true);
    const unlockedAudio = createUnlockedAudioContext();
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          paymentMethod: "PIX",
          paymentChoice: effectivePaymentChoice,
          paidViaPixConfirmed: true,
          pixTxid,
          date,
          startTime: selectedTime,
          durationMinutes: effectiveDuration,
          clientNotes: clientNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        void unlockedAudio?.close().catch(() => {});
        setError(data.error || "Não foi possível confirmar o agendamento.");
        return;
      }
      playBookingSuccessChime(unlockedAudio);
      setConfirmedData({
        appointmentId: data.appointmentId,
        appointmentCode:
          typeof data.appointmentCode === "string" && data.appointmentCode
            ? data.appointmentCode
            : formatSequentialCode(undefined, data.appointmentId),
        paidAmount: typeof data.paidAmount === "number" ? data.paidAmount : amountToPay,
        paymentChoice:
          data.paymentChoice === "FULL" || data.paymentChoice === "DEPOSIT"
            ? data.paymentChoice
            : effectivePaymentChoice,
      });
    } catch {
      void unlockedAudio?.close().catch(() => {});
      setError("Erro de conexão ao confirmar agendamento.");
    } finally {
      setSaving(false);
    }
  };

  const backHref = prefillClient.isLoggedIn ? "/minha-conta/agenda" : "/";
  const receiptWhatsappUrl =
    confirmedData && selectedService
      ? buildPixReceiptWhatsappUrl({
          clientName: prefillClient.fullName || "Cliente",
          serviceName: selectedService.name,
          dateBR: date.split("-").reverse().join("/"),
          time: selectedTime,
          paymentChoice: confirmedData.paymentChoice,
          paidAmountFormatted: formatBRL(confirmedData.paidAmount),
          appointmentCode: confirmedData.appointmentCode,
          whatsappDigits: studioWhatsapp || STUDIO_OWNER_WHATSAPP,
        })
      : "";

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--bg-canvas)] text-[var(--text-primary)] px-4 py-5">
      <div className="max-w-xl w-full mx-auto flex items-center justify-between">
        <Link
          href={backHref}
          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-[0.96]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.6} />
          Voltar
        </Link>
        <BrandLogo href={prefillClient.isLoggedIn ? "/minha-conta" : "/"} compact />
      </div>

      <main className="max-w-xl w-full mx-auto my-6 space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--brand-champagne)] font-semibold">
            Agendamento Online
          </p>
          <h1 className="font-display text-2xl font-semibold mt-0.5">
            Agendar atendimento
          </h1>
        </div>

        {confirmedData && selectedService ? (
          <div className="ios-step-enter-forward bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 sm:p-5 text-center space-y-3">
            <div className="flex flex-col items-center gap-1.5">
              <CheckCircle2
                className="h-9 w-9 text-[var(--status-success)]"
                strokeWidth={1.7}
              />
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--status-warning-bg)] text-[var(--status-warning)] text-[10px] font-semibold">
                Aguardando confirmação do estúdio
              </span>
              <h2 className="font-display text-base font-semibold">
                Agendamento solicitado!
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Envie o comprovante do Pix pelo WhatsApp para agilizar a confirmação.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] text-left text-[11px] space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-[var(--text-secondary)]">Serviço</span>
                <span className="font-semibold text-right truncate">
                  {selectedService.name} • #{confirmedData.appointmentCode}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--text-secondary)]">Data e hora</span>
                <span className="font-semibold tabular-nums">
                  {date.split("-").reverse().join("/")} às {selectedTime}
                </span>
              </div>
              <div className="flex justify-between gap-2 items-center pt-1 border-t border-[var(--border-default)]">
                <span className="text-[var(--text-secondary)] inline-flex items-center gap-1">
                  <PaymentMethodIcon method="PIX" size={13} />
                  Pix ({confirmedData.paymentChoice === "FULL" ? "Total" : "Sinal"})
                </span>
                <span className="font-semibold tabular-nums text-[var(--status-success)]">
                  {formatBRL(confirmedData.paidAmount)}
                </span>
              </div>
            </div>

            <a
              href={receiptWhatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full h-11 px-4 rounded-full bg-[#25D366] hover:bg-[#1EB958] text-[#062412] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
            >
              <WhatsAppIcon size={17} />
              Enviar comprovante no WhatsApp
            </a>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href={prefillClient.isLoggedIn ? "/minha-conta/agenda" : "/entrar"}
                className="h-10 px-3 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold inline-flex items-center justify-center transition-all active:scale-[0.97]"
              >
                {prefillClient.isLoggedIn ? "Minha agenda" : "Minha conta"}
              </Link>
              <Link
                href={prefillClient.isLoggedIn ? "/minha-conta/financeiro" : "/"}
                className="h-10 px-3 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-xs font-medium inline-flex items-center justify-center transition-all active:scale-[0.97]"
              >
                {prefillClient.isLoggedIn ? "Pagamentos" : "Início"}
              </Link>
            </div>
          </div>
        ) : !hasServices ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" strokeWidth={1.6} />}
            title="Nenhum serviço disponível no momento"
            description="Os serviços e valores são definidos pela administradora do estúdio. Assim que forem publicados, aparecerão aqui para você escolher."
            action={
              studioWhatsapp ? (
                <a
                  href={`https://wa.me/${studioWhatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 px-5 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold inline-flex items-center gap-2 transition-all active:scale-[0.97]"
                >
                  <WhatsAppIcon size={16} />
                  Falar no WhatsApp
                </a>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {/* Indicador de passos */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)]">
              {(
                [
                  [1, "1. Serviço"],
                  [2, "2. Data"],
                  [3, "3. Valor"],
                  [4, "4. Pix"],
                ] as const
              ).map(([sNum, label]) => {
                const active = step === sNum;
                const unlocked = step >= sNum;
                return (
                  <button
                    key={sNum}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => goToStep(sNum)}
                    className={`h-8 rounded-full text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-45 disabled:cursor-default whitespace-nowrap ${
                      active
                        ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {error ? (
              <div className="p-3 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs font-medium">
                {error}
              </div>
            ) : null}

            {/* PASSO 1: SERVIÇO E CATEGORIA CADASTRADOS PELO ADMIN */}
            {step === 1 ? (
              <div className={`${stepCardClass} bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-5 space-y-4`}>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--brand-champagne)]" strokeWidth={1.6} />
                  <h2 className="font-display text-base font-semibold">
                    Escolha o serviço
                  </h2>
                </div>

                {categories.length > 2 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(cat)}
                        className={`h-8 px-3.5 rounded-full text-xs font-medium border transition-all active:scale-[0.96] cursor-pointer ${
                          activeCategory === cat
                            ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                            : "bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-default)]"
                        }`}
                      >
                        {cat === "TODAS" ? "Todas categorias" : cat}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-2.5">
                  {filteredServices.map((srv) => {
                    const selected = selectedServiceId === srv.id;
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => setSelectedServiceId(srv.id)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.99] cursor-pointer ${
                          selected
                            ? "border-[var(--action-primary)] bg-[var(--bg-canvas)] ring-1 ring-[var(--action-primary)]"
                            : "border-[var(--border-default)] bg-[var(--bg-canvas)]/60 hover:border-[var(--border-strong)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {srv.category.trim() ? (
                                <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--brand-champagne-subtle)] text-[var(--brand-champagne)] text-[10px] font-semibold uppercase tracking-wide">
                                  {srv.category}
                                </span>
                              ) : null}
                              {srv.sessionsCount > 1 ? (
                                <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] text-[10px] font-semibold">
                                  {srv.sessionsCount} sessões
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                              {srv.name}
                            </p>
                            {srv.description ? (
                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                {srv.description}
                              </p>
                            ) : null}
                            <p className="text-[11px] text-[var(--text-secondary)] inline-flex items-center gap-1 pt-0.5">
                              <Clock className="h-3 w-3" />
                              {formatDuration(srv.durationMinutes)}
                              {srv.sessionsCount > 1
                                ? ` / sessão • ${srv.sessionsCount} sessões`
                                : ""}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="font-display text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                              {srv.price > 0 ? formatBRL(srv.price) : "Sob consulta"}
                            </p>
                            {srv.depositAmount > 0 ? (
                              <p className="text-[11px] text-[var(--text-secondary)] tabular-nums mt-0.5">
                                Sinal {formatBRL(srv.depositAmount)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedService) {
                      setError("Selecione um serviço para continuar.");
                      return;
                    }
                    setError(null);
                    goToStep(2);
                  }}
                  className="h-11 w-full rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer"
                >
                  <span>Continuar para data e horário</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {/* PASSO 2: DATA E HORÁRIO */}
            {step === 2 ? (
              <div className={`${stepCardClass} bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-5 space-y-4`}>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--brand-champagne)]" strokeWidth={1.6} />
                  <h2 className="font-display text-base font-semibold">
                    Escolha data e horário
                  </h2>
                </div>

                <Field label="Data desejada">
                  <IosDatePicker
                    value={date}
                    onChange={(nextDate) => {
                      setDate(nextDate);
                      setError(null);
                    }}
                    minDate={toISODateSP()}
                    ariaLabel="Selecionar data desejada"
                    className="h-11"
                  />
                </Field>

                {date ? (
                  <div className="space-y-2 ios-page-enter">
                    <p className="text-xs font-medium text-[var(--text-primary)]">
                      Horários disponíveis ({formatDuration(effectiveDuration)})
                    </p>
                    {loadingSlots ? (
                      <p className="text-xs text-[var(--text-secondary)]">
                        Consultando disponibilidade...
                      </p>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-xs text-[var(--text-secondary)] p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)]">
                        Nenhum horário livre nesta data para este serviço. Escolha outra data acima.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {availableSlots.map((slot) => {
                          const active = selectedTime === slot.startTime;
                          return (
                            <button
                              key={slot.startTime}
                              type="button"
                              onClick={() => {
                                setSelectedTime(slot.startTime);
                                setError(null);
                              }}
                              className={`h-10 rounded-full text-xs font-semibold tabular-nums border transition-all active:scale-[0.95] cursor-pointer ${
                                active
                                  ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                                  : "bg-[var(--bg-canvas)] border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                              }`}
                            >
                              {slot.startTime}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-dashed border-[var(--border-default)] text-center">
                    Selecione um dia acima para visualizar os horários disponíveis.
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="h-11 px-5 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-xs font-medium cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!date) {
                        setError("Selecione uma data primeiro.");
                        return;
                      }
                      if (!selectedTime) {
                        setError("Selecione um horário disponível.");
                        return;
                      }
                      setError(null);
                      goToStep(3);
                    }}
                    className="h-11 flex-1 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer"
                  >
                    <span>Forma de pagamento</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}

            {/* PASSO 3: ESCOLHA DO PAGAMENTO PIX (SINAL R$ 50 OU VALOR TOTAL) */}
            {step === 3 ? (
              <div className={`${stepCardClass} bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-5 space-y-4`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-[var(--brand-champagne)]" strokeWidth={1.6} />
                    <h2 className="font-display text-base font-semibold">
                      Pagamento via Pix
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] text-[11px] font-medium text-[var(--text-secondary)]">
                    <PaymentMethodIcon method="PIX" size={14} />
                    Obrigatório para reservar
                  </span>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Para confirmar sua reserva na agenda do estúdio, escolha pagar o sinal de reserva ou o valor total do atendimento via Pix.
                </p>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentChoice("DEPOSIT")}
                    className={`w-full text-left p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all active:scale-[0.99] cursor-pointer ${
                      effectivePaymentChoice === "DEPOSIT"
                        ? "border-[var(--action-primary)] bg-[var(--bg-canvas)] ring-1 ring-[var(--action-primary)]"
                        : "border-[var(--border-default)] bg-[var(--bg-canvas)]/60"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">Sinal de reserva</p>
                        <span className="px-2 py-0.5 rounded-full bg-[var(--brand-champagne)]/15 text-[var(--brand-champagne)] text-[10px] font-semibold">
                          Mais escolhido
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {selectedService && selectedService.price > depositAmount
                          ? `Garante seu horário. Restante (${formatBRL(selectedService.price - depositAmount)}) no dia.`
                          : "Garante seu horário na agenda do estúdio."}
                      </p>
                    </div>
                    <span className="font-display text-base font-semibold tabular-nums text-[var(--text-primary)] shrink-0">
                      {formatBRL(depositAmount)}
                    </span>
                  </button>

                  {hasFullOption && selectedService ? (
                    <button
                      type="button"
                      onClick={() => setPaymentChoice("FULL")}
                      className={`w-full text-left p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all active:scale-[0.99] cursor-pointer ${
                        effectivePaymentChoice === "FULL"
                          ? "border-[var(--action-primary)] bg-[var(--bg-canvas)] ring-1 ring-[var(--action-primary)]"
                          : "border-[var(--border-default)] bg-[var(--bg-canvas)]/60"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold">Valor total</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Quita 100% do serviço antecipadamente via Pix
                        </p>
                      </div>
                      <span className="font-display text-base font-semibold tabular-nums text-[var(--text-primary)] shrink-0">
                        {formatBRL(selectedService.price)}
                      </span>
                    </button>
                  ) : null}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="h-11 px-5 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-xs font-medium cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      goToStep(4);
                    }}
                    className="h-11 flex-1 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer"
                  >
                    <PaymentMethodIcon method="PIX" size={18} />
                    <span>Gerar Pix de {formatBRL(amountToPay)}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}

            {/* PASSO 4: QR CODE PIX + COPIA E COLA + "JÁ PAGUEI" */}
            {step === 4 && selectedService ? (
              <form
                onSubmit={handleConfirmBooking}
                className={`${stepCardClass} bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 sm:p-5 space-y-3`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <PaymentMethodIcon method="PIX" size={18} />
                    <h2 className="font-display text-base font-semibold truncate">
                      Pagamento via Pix
                    </h2>
                  </div>
                  <span className="font-display text-base font-semibold tabular-nums text-[var(--brand-champagne)] shrink-0">
                    {formatBRL(amountToPay)}
                  </span>
                </div>

                <div className="px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {selectedService.name}
                    {selectedService.sessionsCount > 1
                      ? ` (${selectedService.sessionsCount}x)`
                      : ""}
                  </span>
                  <span className="tabular-nums shrink-0">
                    {date.split("-").reverse().join("/")} às {selectedTime} •{" "}
                    {effectivePaymentChoice === "FULL" ? "Total" : "Sinal"}
                  </span>
                </div>

                {prefillClient.isLoggedIn ? (
                  <>
                    <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] p-3.5 flex flex-col items-center gap-3">
                      {qrDataUrl ? (
                        <div className="p-2 rounded-xl bg-white shadow-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={qrDataUrl}
                            alt="QR Code Pix para pagamento do agendamento"
                            width={160}
                            height={160}
                            className="w-36 h-36 sm:w-40 sm:h-40 object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-36 h-36 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-xs text-[var(--text-secondary)]">
                          Gerando QR Code...
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => copyToClipboard(pixPayload, "code")}
                        className="w-full h-10 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                      >
                        {copiedTarget === "code" ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-[var(--status-success)]" />
                            Pix Copia e Cola copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copiar código Pix (Copia e Cola)
                          </>
                        )}
                      </button>
                    </div>

                    <Input
                      value={clientNotes}
                      onChange={(e) => setClientNotes(e.target.value)}
                      placeholder="Observações para a sessão (opcional)"
                      className="rounded-xl h-10 text-xs"
                    />

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => goToStep(3)}
                        className="h-11 px-4 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-xs font-medium cursor-pointer"
                      >
                        Voltar
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="h-11 flex-1 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.97] cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                        {saving ? "Confirmando..." : "Já paguei — Confirmar"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-[var(--text-secondary)] text-center">
                      Para gerar o Pix e finalizar seu agendamento, entre ou crie sua conta primeiro:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href="/entrar?next=/agendar"
                        className="h-11 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-sm font-semibold inline-flex items-center justify-center"
                      >
                        Entrar
                      </Link>
                      <Link
                        href="/cadastro"
                        className="h-11 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-sm font-semibold inline-flex items-center justify-center"
                      >
                        Criar conta
                      </Link>
                    </div>
                  </div>
                )}
              </form>
            ) : null}
          </div>
        )}
      </main>

      <div className="text-center">
        <PconSignature />
      </div>
    </div>
  );
}
