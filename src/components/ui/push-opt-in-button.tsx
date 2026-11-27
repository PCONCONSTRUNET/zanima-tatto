"use client";

import React, { useEffect, useState } from "react";
import { Bell, BellRing, CheckCircle2, Smartphone } from "lucide-react";
import { getOneSignalClient } from "@/components/onesignal-init";

export function PushOptInButton({
  userId,
  role,
  compact = false,
  className = "",
}: {
  userId?: string;
  role?: string;
  compact?: boolean;
  className?: string;
}) {
  const [supported, setSupported] = useState(true);
  const [needsIosPwaInstall, setNeedsIosPwaInstall] = useState(false);
  const [optedIn, setOptedIn] = useState(false);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isIos && !isStandalone && !("Notification" in window)) {
      setNeedsIosPwaInstall(true);
      return;
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setSupported(false);
      return;
    }

    let mounted = true;
    let cleanup: (() => void) | undefined;

    const syncState = async () => {
      try {
        const OneSignal = await getOneSignalClient();
        if (!mounted) return;
        const perm = Notification.permission;
        setDenied(perm === "denied");
        setOptedIn(
          Boolean(OneSignal.User.PushSubscription.optedIn) && perm === "granted"
        );
        const onChange = () => {
          if (!mounted) return;
          const curPerm = Notification.permission;
          setDenied(curPerm === "denied");
          setOptedIn(
            Boolean(OneSignal.User.PushSubscription.optedIn) &&
              curPerm === "granted"
          );
        };
        OneSignal.User.PushSubscription.addEventListener?.("change", onChange);
        cleanup = () => {
          OneSignal.User.PushSubscription.removeEventListener?.(
            "change",
            onChange
          );
        };
      } catch {
        // ignore if SDK disabled
      }
    };

    void syncState();
    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  const handleActivate = async () => {
    if (needsIosPwaInstall) {
      setFeedback(
        "No iPhone/iPad, toque em Compartilhar > Adicionar à Tela de Início e abra pelo ícone para ativar Push."
      );
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const OneSignal = await getOneSignalClient();
      await OneSignal.Notifications.requestPermission();
      if (Notification.permission === "granted") {
        await OneSignal.User.PushSubscription.optIn();
        if (userId) {
          await OneSignal.login(userId);
          if (role) {
            await OneSignal.User.addTags({
              role,
              userId,
              channel: role === "CLIENT" ? "client" : "admin",
            });
          }
        }
        setOptedIn(true);
        setDenied(false);
        setFeedback("Push ativado neste dispositivo!");
      } else {
        setDenied(Notification.permission === "denied");
        setFeedback(
          Notification.permission === "denied"
            ? "Permissão bloqueada nas configurações do navegador."
            : "Permissão não concedida."
        );
      }
    } catch {
      setFeedback("Não foi possível ativar neste navegador.");
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleActivate}
        disabled={busy}
        title={
          optedIn
            ? "Notificações Push ativas neste dispositivo"
            : "Ativar notificações Push"
        }
        className={`h-9 px-3 inline-flex items-center gap-1.5 rounded-full border text-xs font-medium transition-all active:scale-[0.95] cursor-pointer ${
          optedIn
            ? "border-[var(--status-success)]/35 bg-[var(--status-success-bg)] text-[var(--status-success)]"
            : "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
        } ${className}`}
      >
        {optedIn ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        ) : (
          <BellRing className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        )}
        <span>{busy ? "Ativando..." : optedIn ? "Push ativo" : "Ativar Push"}</span>
      </button>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        type="button"
        onClick={handleActivate}
        disabled={busy}
        className={`h-10 px-4 inline-flex items-center justify-center gap-2 rounded-full text-xs font-semibold transition-all active:scale-[0.97] cursor-pointer ${
          optedIn
            ? "bg-[var(--status-success-bg)] text-[var(--status-success)] border border-[var(--status-success)]/30"
            : "bg-[var(--action-primary)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)]"
        }`}
      >
        {needsIosPwaInstall ? (
          <Smartphone className="h-4 w-4 shrink-0" strokeWidth={1.7} />
        ) : optedIn ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.7} />
        ) : (
          <Bell className="h-4 w-4 shrink-0" strokeWidth={1.7} />
        )}
        <span>
          {busy
            ? "Ativando..."
            : needsIosPwaInstall
              ? "Instalar PWA para Push no iPhone"
              : optedIn
                ? "Push ativo neste aparelho"
                : denied
                  ? "Push bloqueado no navegador"
                  : "Ativar notificações Push neste aparelho"}
        </span>
      </button>
      {feedback ? (
        <p className="text-[11px] text-[var(--text-secondary)]">{feedback}</p>
      ) : null}
    </div>
  );
}
