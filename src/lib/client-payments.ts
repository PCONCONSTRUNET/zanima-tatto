import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";

export interface OpenObligation {
  id: string;
  sourceType: "PROJECT" | "APPOINTMENT";
  title: string;
  subtitle: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

export async function getClientFinancialOverview(clientId: string) {
  const [payments, projects, standaloneAppointments] = await Promise.all([
    prisma.payment.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { name: true } },
        appointment: { select: { title: true, startAt: true } },
      },
    }),
    prisma.tattooProject.findMany({
      where: {
        clientId,
        negotiatedAmount: { gt: 0 },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        style: true,
        negotiatedAmount: true,
        payments: {
          where: { status: { in: ["CONFIRMED", "PENDING"] } },
          select: { amount: true, status: true },
        },
      },
    }),
    prisma.appointment.findMany({
      where: {
        clientId,
        projectId: null,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        OR: [{ priceEstimate: { gt: 0 } }, { depositRequired: { gt: 0 } }],
      },
      orderBy: { startAt: "desc" },
      select: {
        id: true,
        title: true,
        priceEstimate: true,
        depositRequired: true,
        payments: {
          where: { status: { in: ["CONFIRMED", "PENDING"] } },
          select: { amount: true, status: true },
        },
      },
    }),
  ]);

  const totalPaid = payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((acc, p) => acc + toNumber(p.amount), 0);

  const totalPendingRecorded = payments
    .filter((p) => p.status === "PENDING")
    .reduce((acc, p) => acc + toNumber(p.amount), 0);

  const openObligations: OpenObligation[] = [];

  for (const proj of projects) {
    const total = toNumber(proj.negotiatedAmount);
    const paid = proj.payments
      .filter((p) => p.status === "CONFIRMED")
      .reduce((acc, p) => acc + toNumber(p.amount), 0);
    const pending = proj.payments
      .filter((p) => p.status === "PENDING")
      .reduce((acc, p) => acc + toNumber(p.amount), 0);
    const unbilled = Math.max(0, total - paid - pending);

    if (unbilled > 0) {
      openObligations.push({
        id: `proj:${proj.id}`,
        sourceType: "PROJECT",
        title: proj.name,
        subtitle: `Projeto • ${proj.style}`,
        totalAmount: total,
        paidAmount: paid,
        remainingAmount: unbilled,
      });
    }
  }

  for (const appt of standaloneAppointments) {
    const total = toNumber(appt.priceEstimate) || toNumber(appt.depositRequired);
    if (total <= 0) continue;
    const paid = appt.payments
      .filter((p) => p.status === "CONFIRMED")
      .reduce((acc, p) => acc + toNumber(p.amount), 0);
    const pending = appt.payments
      .filter((p) => p.status === "PENDING")
      .reduce((acc, p) => acc + toNumber(p.amount), 0);
    const unbilled = Math.max(0, total - paid - pending);

    if (unbilled > 0) {
      openObligations.push({
        id: `appt:${appt.id}`,
        sourceType: "APPOINTMENT",
        title: appt.title,
        subtitle: "Sessão agendada",
        totalAmount: total,
        paidAmount: paid,
        remainingAmount: unbilled,
      });
    }
  }

  const totalUnbilled = openObligations.reduce(
    (acc, o) => acc + o.remainingAmount,
    0
  );
  const totalOpen = totalPendingRecorded + totalUnbilled;
  const openCount =
    payments.filter((p) => p.status === "PENDING").length +
    openObligations.length;

  return {
    payments,
    openObligations,
    totalPaid,
    totalPendingRecorded,
    totalUnbilled,
    totalOpen,
    openCount,
  };
}
