import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";
import { ProjectsListClient } from "@/components/admin/projects-client";

export const dynamic = "force-dynamic";

export default async function AdminProjetosPage() {
  await requireAdminPage();

  const [projects, clients] = await Promise.all([
    prisma.tattooProject.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { id: true, fullName: true } },
        payments: {
          where: { status: "CONFIRMED" },
          select: { amount: true },
        },
        _count: { select: { appointments: true, media: true } },
      },
    }),
    prisma.client.findMany({
      where: { isAnonymized: false },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  return (
    <ProjectsListClient
      initialProjects={projects.map((p) => {
        const paid = p.payments.reduce((acc, pay) => acc + toNumber(pay.amount), 0);
        const negotiated = toNumber(p.negotiatedAmount);
        return {
          id: p.id,
          name: p.name,
          clientName: p.client.fullName,
          style: p.style,
          bodyRegion: p.bodyRegion,
          approxSizeCm: p.approxSizeCm,
          stage: p.stage,
          negotiatedAmount: negotiated,
          paidAmount: paid,
          remainingAmount: Math.max(0, negotiated - paid),
          plannedSessions: p.plannedSessions,
          appointmentsCount: p._count.appointments,
        };
      })}
      clients={clients}
    />
  );
}
