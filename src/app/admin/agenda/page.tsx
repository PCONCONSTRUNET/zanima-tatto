import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/security/rbac";
import { toISODateSP, toNumber } from "@/lib/format";
import { autoCompleteElapsedAppointments } from "@/lib/agenda/scheduling";
import { AgendaClient } from "@/components/admin/agenda-client";

export const dynamic = "force-dynamic";

export default async function AdminAgendaPage() {
  await requireAdminPage();
  await autoCompleteElapsedAppointments();
  const todayStr = toISODateSP();

  const [appointments, blocks, rules, clients, projects, services] =
    await Promise.all([
      prisma.appointment.findMany({
        orderBy: { startAt: "asc" },
        include: {
          client: { select: { id: true, fullName: true, whatsapp: true } },
          project: { select: { id: true, name: true, style: true } },
          service: { select: { id: true, name: true, category: true, sessionsCount: true } },
          payments: { select: { id: true, amount: true, status: true, kind: true } },
          history: { orderBy: { createdAt: "desc" }, take: 8 },
        },
      }),
      prisma.availabilityBlock.findMany({
        orderBy: { startAt: "asc" },
        take: 40,
      }),
      prisma.availabilityRule.findMany({
        orderBy: { dayOfWeek: "asc" },
      }),
      prisma.client.findMany({
        where: { isAnonymized: false },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true, whatsapp: true },
      }),
      prisma.tattooProject.findMany({
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, clientId: true },
      }),
      prisma.studioService.findMany({
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);

  return (
    <AgendaClient
      initialDate={todayStr}
      initialAppointments={appointments.map((a) => {
        const confirmedPaid = a.payments
          .filter((p) => p.status === "CONFIRMED")
          .reduce((acc, p) => acc + toNumber(p.amount), 0);
        const estimated = toNumber(a.priceEstimate);
        return {
          id: a.id,
          clientId: a.clientId,
          clientName: a.client.fullName,
          clientWhatsapp: a.client.whatsapp,
          projectId: a.projectId,
          projectName: a.project?.name || null,
          serviceId: a.serviceId,
          serviceName: a.service?.name || null,
          serviceCategory: a.service?.category || null,
          preferredPaymentMethod: a.preferredPaymentMethod || null,
          title: a.title,
          description: a.description,
          startAt: a.startAt.toISOString(),
          endAt: a.endAt.toISOString(),
          durationMinutes: a.durationMinutes,
          bufferAfterMinutes: a.bufferAfterMinutes,
          status: a.status,
          sessionNumber: a.sessionNumber,
          totalSessions: Math.max(a.totalSessions || 1, a.service?.sessionsCount || 1),
          recurrenceGroupId: a.recurrenceGroupId,
          priceEstimate: a.priceEstimate ? toNumber(a.priceEstimate) : null,
          depositRequired: a.depositRequired ? toNumber(a.depositRequired) : null,
          hasPendingPayment: estimated > 0 && confirmedPaid < estimated,
          paidAmount: confirmedPaid,
          clientNotes: a.clientNotes,
          internalNotes: a.internalNotes,
          history: a.history.map((h) => ({
            id: h.id,
            previousStatus: h.previousStatus,
            newStatus: h.newStatus,
            reason: h.reason,
            createdAt: h.createdAt.toISOString(),
          })),
        };
      })}
      initialBlocks={blocks.map((b) => ({
        id: b.id,
        title: b.title,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        blockType: b.blockType,
        reason: b.reason,
      }))}
      initialRules={rules.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        slotStepMinutes: r.slotStepMinutes,
        bufferMinutes: r.bufferMinutes,
        isActive: r.isActive,
      }))}
      clients={clients}
      projects={projects}
      initialServices={services.map((s) => ({
        id: s.id,
        category: s.category,
        name: s.name,
        description: s.description,
        durationMinutes: s.durationMinutes,
        sessionsCount: s.sessionsCount,
        price: toNumber(s.price),
        depositAmount: toNumber(s.depositAmount),
        isActive: s.isActive,
      }))}
    />
  );
}
