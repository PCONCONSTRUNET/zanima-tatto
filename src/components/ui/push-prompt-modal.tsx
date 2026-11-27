"use client";

import React, { useEffect, useState } from "react";
import { BellRing, CheckCircle2, Smartphone, X } from "lucide-react";
import { getOneSignalClient } from "@/components/onesignal-init";
import { Button } from "@/components/ui/primitives";

const PROMPT_FLAG_KEY = "zanima-prompt-push";

export function PushPromptModal({
  userId,
  role,
}: {
  userId: string;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  const [needsIosPwa, setNeedsIosPwa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let shouldPrompt = false;
    try {
      shouldPrompt = sessionStorage.getItem(PROMPT_FLAG_KEY) === "1";
      if (shouldPrompt) {
        sessionStorage.removeItem(PROMPT_FLAG_KEY);
      }
    } catch {
      shouldPrompt = false;
    }

    if (!shouldPrompt) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isIos && !isStandalone && !("Notification" in window)) {
      setNeedsIosPwa(true);
      setOpen(true);
      return;
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return;
    }

    let active = true;
    const checkSubscription = async () => {
      try {
        const OneSignal = await getOneSignalClient();
        if (!active) return;
        const alreadyActive =
          Notification.permission === "granted" &&
          Boolean(OneSignal.User.PushSubscription.optedIn);
        if (!alreadyActive) {
          setOpen(true);
        }
      } catch {
        if (active && Notification.permission !== "granted") {
          setOpen(true);
        }
      }
    };

    const timer = window.setTimeout(() => {
      void checkSubscription();
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const handleActivate = async () => {
    if (needsIosPwa) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const OneSignal = await getOneSignalClient();
      await OneSignal.Notifications.requestPermission();
      if (Notification.permission === "granted") {
        await OneSignal.User.PushSubscription.optIn();
        await OneSignal.login(userId);
        await OneSignal.User.addTags({
          role,
          userId,
          channel: role === "CLIENT" ? "client" : "admin",
        });
        setActivated(true);
        setFeedback("Notificações ativadas com sucesso!");
        window.setTimeout(() => {
          setOpen(false);
        }, 900);
      } else {
        setFeedback(
          Notification.permission === "denied"
            ? "As notificações estão bloqueadas nas configurações do navegador."
            : "Permissão não concedida."
        );
      }
    } catch {
      setFeedback("Não foi possível ativar neste navegador.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const isClient = role === "CLIENT";

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) setOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-prompt-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[28px] p-5 space-y-4 shadow-2xl text-center">
        <div className="flex justify-end -mb-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar aviso"
            className="h-8 w-8 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] inline-flex items-center justify-center cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-auto h-12 w-12 rounded-full bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/40 text-[var(--brand-champagne)] flex items-center justify-center">
          {activated ? (
            <CheckCircle2 className="h-6 w-6 text-[var(--status-success)]" />
          ) : needsIosPwa ? (
            <Smartphone className="h-6 w-6" />
          ) : (
            <BellRing className="h-6 w-6" />
          )}
        </div>

        <div className="space-y-1.5">
          <h2
            id="push-prompt-title"
            className="font-display text-base font-semibold text-[var(--text-primary)]"
          >
            {activated
              ? "Notificações ativadas!"
              : "Ativar notificações Push?"}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {needsIosPwa
              ? "No iPhone/iPad, adicione o app à Tela de Início (Compartilhar → Adicionar à Tela de Início) para receber notificações Push."
              : isClient
                ? "Receba avisos instantâneos sobre confirmações de horário, pagamentos concluídos e comunicados do estúdio."
                : "Receba alertas em tempo real quando clientes agendarem, enviarem Pix, cancelarem ou faltarem."}
          </p>
        </div>

        {feedback ? (
          <p
            className={`text-xs font-medium ${
              activated
                ? "text-[var(--status-success)]"
                : "text-[var(--status-danger)]"
            }`}
          >
            {feedback}
          </p>
        ) : null}

        {!activated ? (
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Agora não
            </Button>
            <Button
              type="button"
              variant="primary"
              className="w-full"
              disabled={busy}
              onClick={handleActivate}
            >
              <BellRing className="h-4 w-4" />
              {needsIosPwa
                ? "Entendi"
                : busy
                  ? "Ativando..."
                  : "Ativar agora"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
