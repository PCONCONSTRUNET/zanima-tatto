import React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { formatDateTimeBR } from "@/lib/format";

export type AlertTone = "success" | "info" | "warning" | "error";

export function resolveNotificationTone(n: {
  eventType: string;
  title: string;
  body: string;
  status: string;
}): AlertTone {
  const ev = (n.eventType || "").toUpperCase();
  const titleBody = `${n.title} ${n.body}`.toLowerCase();

  if (
    n.status === "FAILED" ||
    ev.includes("CANCEL") ||
    ev.includes("NO_SHOW") ||
    ev.includes("OVERDUE") ||
    ev.includes("ERROR") ||
    ev.includes("FAIL") ||
    titleBody.includes("cancel") ||
    titleBody.includes("atras") ||
    titleBody.includes("erro")
  ) {
    return "error";
  }

  if (
    n.status === "SKIPPED_UNCONFIGURED" ||
    ev.includes("NEXT_PENDING") ||
    ev.includes("PENDING") ||
    ev.includes("STOCK") ||
    ev.includes("RESCHEDULE") ||
    ev.includes("DUE") ||
    titleBody.includes("falta agendar") ||
    titleBody.includes("reagend") ||
    titleBody.includes("pendente")
  ) {
    return "warning";
  }

  if (
    ev.includes("CONFIRMED") ||
    ev.includes("PAYMENT") ||
    ev.includes("APPROVED") ||
    ev.includes("ONLINE_BOOKING") ||
    ev.includes("CREATED") ||
    titleBody.includes("concluíd") ||
    titleBody.includes("confirmad") ||
    titleBody.includes("pago")
  ) {
    return "success";
  }

  return "info";
}

export const ALERT_TONE_STYLES: Record<
  AlertTone,
  { container: string; icon: string; badge: string; label: string }
> = {
  success: {
    container:
      "bg-green-100 dark:bg-green-900 border-l-4 border-green-500 dark:border-green-700 text-green-900 dark:text-green-100 hover:bg-green-200 dark:hover:bg-green-800",
    icon: "text-green-600 dark:text-green-300",
    badge: "bg-green-600/15 text-green-900 dark:text-green-100",
    label: "Sucesso",
  },
  info: {
    container:
      "bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-500 dark:border-blue-700 text-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-800",
    icon: "text-blue-600 dark:text-blue-300",
    badge: "bg-blue-600/15 text-blue-900 dark:text-blue-100",
    label: "Info",
  },
  warning: {
    container:
      "bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-200 dark:hover:bg-yellow-800",
    icon: "text-yellow-600 dark:text-yellow-300",
    badge: "bg-yellow-600/15 text-yellow-900 dark:text-yellow-100",
    label: "Aviso",
  },
  error: {
    container:
      "bg-red-100 dark:bg-red-900 border-l-4 border-red-500 dark:border-red-700 text-red-900 dark:text-red-100 hover:bg-red-200 dark:hover:bg-red-800",
    icon: "text-red-600 dark:text-red-300",
    badge: "bg-red-600/15 text-red-900 dark:text-red-100",
    label: "Alerta",
  },
};

export function AlertIconSvg({ className }: { className: string }) {
  return (
    <svg
      stroke="currentColor"
      viewBox="0 0 24 24"
      fill="none"
      className={`h-5 w-5 flex-shrink-0 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13 16h-1v-4h1m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Card de alerta colorido compartilhado entre painel admin e área do cliente. */
export function AlertNotificationCard({
  eventType,
  title,
  body,
  linkUrl,
  status,
  createdAt,
  tone: forcedTone,
}: {
  eventType: string;
  title: string;
  body: string;
  linkUrl: string | null;
  status: string;
  createdAt: Date | string;
  tone?: AlertTone;
}) {
  const tone =
    forcedTone ?? resolveNotificationTone({ eventType, title, body, status });
  const st = ALERT_TONE_STYLES[tone];
  const unread = status === "UNREAD";

  return (
    <div
      role="alert"
      className={`${st.container} px-3 py-2.5 rounded-xl flex items-start gap-2.5 transition duration-200`}
    >
      <AlertIconSvg className={`${st.icon} mt-0.5`} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold leading-tight truncate">{title}</p>
          {unread ? (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${st.badge}`}
            >
              Nova
            </span>
          ) : null}
        </div>
        <p className="text-[11px] font-medium leading-snug opacity-95">
          {body}
        </p>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <p className="text-[10px] opacity-75 tabular-nums truncate">
            {st.label} • {formatDateTimeBR(createdAt)}
          </p>
          {linkUrl ? (
            <Link
              href={linkUrl}
              className={`h-6 px-2.5 rounded-md text-[11px] font-bold inline-flex items-center gap-1 shrink-0 ${st.badge}`}
            >
              <span>Abrir</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
