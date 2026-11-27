import Link from "next/link";
import {
  BookHeart,
  Calendar,
  ChevronRight,
  Receipt,
  Sparkles,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireClientPage } from "@/lib/security/rbac";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import { autoCompleteElapsedAppointments } from "@/lib/agenda/scheduling";
import { getClientFinancialOverview } from "@/lib/client-payments";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  PROJECT_STAGE_LABELS,
} from "@/lib/domain-labels";
import { StatusBadge } from "@/components/ui/primitives";
import { AlertNotificationCard } from "@/components/ui/alert-notification-card";

export const dynamic = "force-dynamic";

export default async function ClientHomePage() {
  const user = await requireClientPage();
  await autoCompleteElapsedAppointments();
  const clientId = user.clientId;

  if (!clientId) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-6 text-sm text-[var(--text-secondary)]">
        Sua conta ainda não está vinculada a um cadastro de cliente. Entre em contato com o estúdio.
      </div>
    );
  }

  const [
    nextAppointment,
    clientAppointments,
    activeProjects,
    sentQuotes,
    financialOverview,
    notifications,
    passportsCount,
  ] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        clientId,
        startAt: { gte: new Date() },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        title: true,
        startAt: true,
        durationMinutes: true,
        status: true,
      },
    }),
    prisma.appointment.findMany({
      where: { clientId },
      select: {
        id: true,
        title: true,
        status: true,
        serviceId: true,
        sessionNumber: true,
        totalSessions: true,
        recurrenceGroupId: true,
        service: { select: { name: true, sessionsCount: true } },
      },
    }),
    prisma.tattooProject.findMany({
      where: { clientId, stage: { not: "COMPLETED" } },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: {
        id: true,
        name: true,
        style: true,
        stage: true,
        aftercareGuidance: true,
      },
    }),
    prisma.quoteRequest.findMany({
      where: { clientId, status: "SENT" },
      orderBy: { respondedAt: "desc" },
      select: {
        id: true,
        title: true,
        quotedAmount: true,
        depositAmount: true,
      },
    }),
    getClientFinancialOverview(clientId),
    prisma.notification.findMany({
      where: { recipientUserId: user.id, channel: "IN_APP" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.tattooPassport.count({ where: { clientId } }),
  ]);

  const firstName = user.name.split(" ")[0] || user.name;
  const { totalOpen } = financialOverview;
  const pendingNextSessions = clientAppointments.filter((a) => {
    const total = Math.max(a.totalSessions || 1, a.service?.sessionsCount || 1);
    if (a.status !== "COMPLETED" || a.sessionNumber >= total) return false;
    return !clientAppointments.some(
      (other) =>
        other.id !== a.id &&
        other.status !== "CANCELLED" &&
        other.status !== "NO_SHOW" &&
        other.sessionNumber > a.sessionNumber &&
        ((a.serviceId && other.serviceId === a.serviceId) ||
          (a.recurrenceGroupId && other.recurrenceGroupId === a.recurrenceGroupId) ||
          other.title === a.title)
    );
  });

  return (
    <div className="space-y-4">
      {/* Cabeçalho e atalhos rápidos em 2 colunas simétricas */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--brand-champagne)] font-semibold">
            Espaço Pessoal
          </p>
          <h1 className="font-display text-2xl font-semibold mt-0.5">
            Olá, {firstName}
          </h1>
        </div>

        <div className="grid grid-cols-2 sm:flex gap-2">
          <Link
            href="/minha-conta/proxima-tattoo"
            className="h-10 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-medium hover:bg-[var(--bg-subtle)] transition-all active:scale-[0.97] whitespace-nowrap"
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--brand-champagne)] shrink-0" strokeWidth={1.6} />
            <span>Próxima Tattoo</span>
          </Link>
          <Link
            href="/minha-conta/minha-historia-na-pele"
            className="h-10 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold hover:bg-[var(--action-primary-hover)] transition-all active:scale-[0.97] whitespace-nowrap"
          >
            <BookHeart className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
            <span>História ({passportsCount})</span>
          </Link>
        </div>
      </div>

      {/* Card principal de próximo atendimento */}
      {pendingNextSessions.length > 0 ? (
        <div className="space-y-2">
          {pendingNextSessions.map((a) => {
            const total = Math.max(a.totalSessions || 1, a.service?.sessionsCount || 1);
            const nextNum = a.sessionNumber + 1;
            return (
              <div
                key={`home-follow-${a.id}`}
                className="rounded-3xl border border-[var(--brand-champagne)]/45 bg-[var(--brand-champagne-subtle)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-champagne)]">
                    Sessão {a.sessionNumber} de {total} concluída
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                    Falta agendar a Sessão {nextNum}/{total} — {a.service?.name || a.title}
                  </p>
                </div>
                <Link
                  href="/agendar"
                  className="h-9 px-4 inline-flex items-center justify-center rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold shrink-0"
                >
                  Agendar Sessão {nextNum}
                </Link>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
            <Calendar className="h-3.5 w-3.5 text-[var(--brand-champagne)]" strokeWidth={1.6} />
            Próximo atendimento
          </span>
          <Link
            href="/minha-conta/agenda"
            className="h-7 px-2.5 rounded-full bg-[var(--bg-subtle)] text-[11px] font-medium text-[var(--text-primary)] inline-flex items-center gap-1 hover:bg-[var(--bg-hover)] transition-colors"
          >
            <span>Ver agenda</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {nextAppointment ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{nextAppointment.title}</p>
              <p className="text-xs text-[var(--text-secondary)] tabular-nums mt-0.5">
                {formatDateTimeBR(nextAppointment.startAt)} •{" "}
                {nextAppointment.durationMinutes} min
              </p>
            </div>
            <div className="shrink-0 self-start">
              <StatusBadge
                label={
                  APPOINTMENT_STATUS_LABELS[nextAppointment.status] ||
                  nextAppointment.status
                }
                tone={APPOINTMENT_STATUS_TONE[nextAppointment.status] || "neutral"}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-secondary)]">
              Nenhum horário marcado no momento.
            </p>
            <Link
              href="/agendar"
              className="h-8 px-3.5 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold inline-flex items-center shrink-0 hover:bg-[var(--action-primary-hover)] transition-all active:scale-[0.97]"
            >
              Agendar
            </Link>
          </div>
        )}
      </div>

      {/* Bento 2 colunas: Pagamentos e Minhas Tattoos */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/minha-conta/financeiro"
          className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 flex flex-col justify-between gap-3 hover:border-[var(--border-strong)] transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Wallet className="h-3.5 w-3.5 text-[var(--brand-champagne)]" strokeWidth={1.6} />
              Pagamentos
            </span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold tabular-nums">
              {formatBRL(totalOpen)}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              {totalOpen === 0
                ? "Tudo em dia"
                : "Saldo em aberto"}
            </p>
          </div>
        </Link>

        <Link
          href="/minha-conta/minhas-tattoos"
          className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 flex flex-col justify-between gap-3 hover:border-[var(--border-strong)] transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-[var(--brand-champagne)]" strokeWidth={1.6} />
              Minhas Tattoos
            </span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold tabular-nums">
              {activeProjects.length}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              {activeProjects.length === 0
                ? "Sem projetos ativos"
                : "Em andamento"}
            </p>
          </div>
        </Link>
      </div>

      {/* Orçamentos aguardando resposta */}
      {sentQuotes.length > 0 ? (
        <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
            <Receipt className="h-3.5 w-3.5 text-[var(--status-info)]" strokeWidth={1.6} />
            Orçamentos para aprovação ({sentQuotes.length})
          </div>
          <div className="space-y-2">
            {sentQuotes.map((q) => (
              <div
                key={q.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-2xl bg-[var(--bg-subtle)] text-xs"
              >
                <div>
                  <p className="font-semibold text-sm text-[var(--text-primary)]">
                    {q.title}
                  </p>
                  <p className="text-[var(--text-secondary)] tabular-nums mt-0.5">
                    Valor: {formatBRL(q.quotedAmount)} • Sinal:{" "}
                    {formatBRL(q.depositAmount)}
                  </p>
                </div>
                <Link
                  href="/minha-conta/minhas-tattoos"
                  className="h-9 px-4 inline-flex items-center justify-center rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold transition-all active:scale-[0.97]"
                >
                  Revisar proposta
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[var(--border-default)] flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">
              Projetos em andamento
            </h2>
            <Link
              href="/minha-conta/minhas-tattoos"
              className="h-7 px-2.5 rounded-full bg-[var(--bg-subtle)] text-[11px] font-medium inline-flex items-center gap-1 hover:bg-[var(--bg-hover)]"
            >
              <span>Ver todos</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {activeProjects.length === 0 ? (
            <p className="p-4 text-xs text-[var(--text-secondary)]">
              Nenhum projeto ativo no momento.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-default)]">
              {activeProjects.map((p) => (
                <li
                  key={p.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{p.style}</p>
                  </div>
                  <StatusBadge
                    label={PROJECT_STAGE_LABELS[p.stage] || p.stage}
                    tone="info"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[var(--border-default)]">
            <h2 className="font-display text-sm font-semibold">Notificações</h2>
          </div>
          {notifications.length === 0 ? (
            <p className="p-4 text-xs text-[var(--text-secondary)]">
              Nenhuma notificação recente.
            </p>
          ) : (
            <div className="p-3 space-y-2">
              {notifications.map((n) => (
                <AlertNotificationCard
                  key={n.id}
                  eventType={n.eventType}
                  title={n.title}
                  body={n.body}
                  linkUrl={n.linkUrl}
                  status={n.status}
                  createdAt={n.createdAt}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
