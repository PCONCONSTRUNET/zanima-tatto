import { prisma } from "@/lib/prisma";
import { formatSequentialCode, toNumber } from "@/lib/format";
import { requireClientPage } from "@/lib/security/rbac";
import { autoCompleteElapsedAppointments } from "@/lib/agenda/scheduling";
import { ClientAgendaClient } from "@/components/client/client-agenda-client";

export const dynamic = "force-dynamic";

export default async function ClientAgendaPage() {
  const user = await requireClientPage();
  await autoCompleteElapsedAppointments();
  const appointments = user.clientId
    ? await prisma.appointment.findMany({
        where: { clientId: user.clientId },
        orderBy: { startAt: "desc" },
        select: {
          id: true,
          codeNumber: true,
          title: true,
          startAt: true,
          endAt: true,
          durationMinutes: true,
          status: true,
          serviceId: true,
          service: { select: { id: true, name: true, sessionsCount: true } },
          sessionNumber: true,
          totalSessions: true,
          recurrenceGroupId: true,
          priceEstimate: true,
          depositRequired: true,
          preferredPaymentMethod: true,
          clientNotes: true,
          confirmedAt: true,
          project: { select: { id: true, name: true } },
          payments: {
            where: { status: { in: ["PENDING", "CONFIRMED"] } },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              amount: true,
              status: true,
              kind: true,
              method: true,
            },
          },
        },
      })
    : [];

  return (
    <ClientAgendaClient
      appointments={appointments.map((a) => {
        const latestPayment = a.payments[0] || null;
        return {
          id: a.id,
          code: formatSequentialCode(a.codeNumber, a.id),
          title: a.title,
          startAt: a.startAt.toISOString(),
          endAt: a.endAt.toISOString(),
          durationMinutes: a.durationMinutes,
          status: a.status,
          serviceId: a.serviceId,
          serviceName: a.service?.name || null,
          sessionNumber: a.sessionNumber,
          totalSessions: Math.max(
            a.totalSessions || 1,
            a.service?.sessionsCount || 1
          ),
          recurrenceGroupId: a.recurrenceGroupId,
          priceEstimate: a.priceEstimate ? toNumber(a.priceEstimate) : null,
          depositRequired: a.depositRequired
            ? toNumber(a.depositRequired)
            : null,
          preferredPaymentMethod: a.preferredPaymentMethod || null,
          clientNotes: a.clientNotes || null,
          projectName: a.project?.name || null,
          confirmedAt: a.confirmedAt ? a.confirmedAt.toISOString() : null,
          latestPayment: latestPayment
            ? {
                amount: toNumber(latestPayment.amount),
                status: latestPayment.status,
                kind: latestPayment.kind,
                method: latestPayment.method,
              }
            : null,
        };
      })}
    />
  );
}
