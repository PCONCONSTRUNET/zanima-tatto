import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/security/rbac";
import { formatDateLongBR, toNumber } from "@/lib/format";
import { autoCompleteElapsedAppointments } from "@/lib/agenda/scheduling";
import { DashboardClient } from "@/components/admin/dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [, user] = await Promise.all([
    autoCompleteElapsedAppointments().catch(() => {}),
    requireAdminPage(),
  ]);

  const now = new Date();
  const spParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const map = Object.fromEntries(spParts.map((p) => [p.type, p.value]));
  const todayStr = `${map.year}-${map.month}-${map.day}`;

  const todayStart = new Date(`${todayStr}T00:00:00-03:00`);
  const todayEnd = new Date(`${todayStr}T23:59:59-03:00`);

  const year = Number(map.year);
  const month = Number(map.month);
  const monthStart = new Date(
    `${year}-${String(month).padStart(2, "0")}-01T00:00:00-03:00`
  );
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const monthEnd = new Date(
    `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00-03:00`
  );

  const [
    todayAppointments,
    upcomingAppointments,
    pendingQuotes,
    awaitingConfirmationCount,
    studioMonthIncomeRows,
    reminders,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startAt: { gte: todayStart, lte: todayEnd },
        status: { not: "CANCELLED" },
      },
      orderBy: { startAt: "asc" },
      include: {
        client: { select: { id: true, fullName: true, whatsapp: true } },
        service: { select: { name: true, sessionsCount: true } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        startAt: { gt: todayEnd },
        status: {
          in: [
            "REQUESTED",
            "AWAITING_CONFIRMATION",
            "AWAITING_DEPOSIT",
            "CONFIRMED",
          ],
        },
      },
      orderBy: { startAt: "asc" },
      take: 4,
      include: {
        client: { select: { id: true, fullName: true, whatsapp: true } },
        service: { select: { name: true, sessionsCount: true } },
      },
    }),
    prisma.quoteRequest.findMany({
      where: { status: { in: ["NEW", "ANALYZING"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { client: { select: { id: true, fullName: true } } },
    }),
    prisma.appointment.count({
      where: {
        status: {
          in: ["REQUESTED", "AWAITING_CONFIRMATION", "AWAITING_DEPOSIT"],
        },
      },
    }),
    prisma.financialTransaction.findMany({
      where: {
        context: "STUDIO",
        type: "INCOME",
        status: { in: ["PAID", "RECEIVED"] },
        competenceDate: { gte: monthStart, lt: monthEnd },
      },
      select: { amount: true },
    }),
    prisma.reminder.findMany({
      where: { userId: user.id },
      orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }],
      take: 6,
    }),
  ]);

  const monthIncome = studioMonthIncomeRows.reduce(
    (acc, row) => acc + toNumber(row.amount),
    0
  );

  return (
    <DashboardClient
      userName={user.name}
      hideValues={user.hideFinancialValues}
      todayFormatted={formatDateLongBR(now)}
      todayStr={todayStr}
      summary={{
        monthIncome,
        awaitingConfirmationCount,
        pendingQuotesCount: pendingQuotes.length,
      }}
      todayAppointments={todayAppointments.map((a) => ({
        id: a.id,
        title: a.title,
        serviceName: a.service?.name ?? null,
        clientName: a.client.fullName,
        clientId: a.client.id,
        clientWhatsapp: a.client.whatsapp,
        startAt: a.startAt.toISOString(),
        endAt: a.endAt.toISOString(),
        durationMinutes: a.durationMinutes,
        sessionNumber: a.sessionNumber,
        totalSessions: Math.max(a.totalSessions || 1, a.service?.sessionsCount || 1),
        priceEstimate: a.priceEstimate ? toNumber(a.priceEstimate) : null,
        depositRequired: a.depositRequired ? toNumber(a.depositRequired) : null,
        preferredPaymentMethod: a.preferredPaymentMethod ?? null,
        clientNotes: a.clientNotes ?? null,
        internalNotes: a.internalNotes ?? null,
        status: a.status,
      }))}
      upcomingAppointments={upcomingAppointments.map((a) => ({
        id: a.id,
        title: a.title,
        serviceName: a.service?.name ?? null,
        clientId: a.client.id,
        clientName: a.client.fullName,
        clientWhatsapp: a.client.whatsapp,
        startAt: a.startAt.toISOString(),
        endAt: a.endAt.toISOString(),
        durationMinutes: a.durationMinutes,
        sessionNumber: a.sessionNumber,
        totalSessions: Math.max(a.totalSessions || 1, a.service?.sessionsCount || 1),
        priceEstimate: a.priceEstimate ? toNumber(a.priceEstimate) : null,
        depositRequired: a.depositRequired ? toNumber(a.depositRequired) : null,
        preferredPaymentMethod: a.preferredPaymentMethod ?? null,
        clientNotes: a.clientNotes ?? null,
        internalNotes: a.internalNotes ?? null,
        status: a.status,
      }))}
      pendingQuotes={pendingQuotes.map((q) => ({
        id: q.id,
        title: q.title,
        clientId: q.client.id,
        clientName: q.client.fullName,
        style: q.style,
        status: q.status,
      }))}
      initialReminders={reminders.map((r) => ({
        id: r.id,
        title: r.title,
        dueAt: r.dueAt.toISOString(),
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      }))}
    />
  );
}
