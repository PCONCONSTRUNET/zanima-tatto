"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button, EmptyState } from "@/components/ui/primitives";
import {
  ALERT_TONE_STYLES,
  AlertIconSvg,
  AlertNotificationCard,
  type AlertTone,
  resolveNotificationTone,
} from "@/components/ui/alert-notification-card";

type NotificationItem = {
  id: string;
  eventType: string;
  channel: string;
  title: string;
  body: string;
  linkUrl: string | null;
  status: string;
  createdAt: string;
};

export function NotificationsClient({
  notifications,
  integrations,
}: {
  notifications: NotificationItem[];
  integrations: Array<{
    name: string;
    configured: boolean;
    detail: string;
  }>;
}) {
  const router = useRouter();
  const [toneFilter, setToneFilter] = useState<"ALL" | AlertTone>("ALL");
  const [marking, setMarking] = useState(false);

  const enriched = useMemo(
    () =>
      notifications.map((n) => ({
        ...n,
        tone: resolveNotificationTone(n),
      })),
    [notifications]
  );

  const filtered = useMemo(() => {
    if (toneFilter === "ALL") return enriched;
    return enriched.filter((n) => n.tone === toneFilter);
  }, [enriched, toneFilter]);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_notifications_read" }),
      });
      router.refresh();
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-champagne)]">
            Sistema & Alertas
          </p>
          <h1 className="font-display text-2xl font-semibold">
            Central de Notificações
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Acompanhe confirmações, avisos de próximas sessões, cobranças e status das integrações.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={marking}
          onClick={markAllRead}
        >
          <CheckCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
          {marking ? "Marcando..." : "Marcar todas como lidas"}
        </Button>
      </div>

      {/* Estado real das integrações externas no modelo alerta */}
      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Canais de envio do sistema
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {integrations.map((int) => {
            const tone: AlertTone = int.configured ? "success" : "warning";
            const st = ALERT_TONE_STYLES[tone];
            return (
              <div
                key={int.name}
                role="alert"
                className={`${st.container} p-3 rounded-lg flex items-center transition duration-300 ease-in-out transform hover:scale-[1.02]`}
              >
                <AlertIconSvg className={`${st.icon} mr-2.5`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">
                    {int.name} —{" "}
                    {int.configured ? "Configurado" : "Não configurado"}
                  </p>
                  <p className="text-[11px] opacity-85 truncate">{int.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Filtros por tipo */}
      {notifications.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["ALL", `Todas (${enriched.length})`],
              [
                "success",
                `Sucesso (${enriched.filter((x) => x.tone === "success").length})`,
              ],
              [
                "info",
                `Info (${enriched.filter((x) => x.tone === "info").length})`,
              ],
              [
                "warning",
                `Avisos (${enriched.filter((x) => x.tone === "warning").length})`,
              ],
              [
                "error",
                `Alertas (${enriched.filter((x) => x.tone === "error").length})`,
              ],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setToneFilter(key)}
              className={`h-8 px-3.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                toneFilter === key
                  ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Lista de Notificações no modelo Alert Colorido */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" strokeWidth={1.5} />}
          title="Nenhuma notificação registrada"
          description="Novos agendamentos, próximas sessões pendentes, orçamentos e alertas aparecerão aqui."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <AlertNotificationCard
              key={n.id}
              eventType={n.eventType}
              title={n.title}
              body={n.body}
              linkUrl={n.linkUrl}
              status={n.status}
              createdAt={n.createdAt}
              tone={n.tone}
            />
          ))}
        </div>
      )}
    </div>
  );
}
