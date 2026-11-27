import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";
import { ProjectDetailClient } from "@/components/admin/project-detail-client";

export const dynamic = "force-dynamic";

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;

  const project = await prisma.tattooProject.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          fullName: true,
          whatsapp: true,
          documentSignatures: {
            where: { kind: "IMAGE_AUTHORIZATION" },
            select: { id: true, signedAt: true },
          },
        },
      },
      appointments: { orderBy: { startAt: "asc" } },
      media: {
        orderBy: { createdAt: "desc" },
        include: { file: true },
      },
      payments: { orderBy: { createdAt: "desc" } },
      stockMovements: {
        orderBy: { createdAt: "desc" },
        include: { stockItem: { select: { name: true, unit: true } } },
      },
      aftercareEntries: { orderBy: { createdAt: "desc" } },
      passport: true,
    },
  });

  if (!project) notFound();

  const paidTotal = project.payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((acc, p) => acc + toNumber(p.amount), 0);
  const negotiated = toNumber(project.negotiatedAmount);
  const materialCost = project.stockMovements
    .filter((m) => m.type === "OUT")
    .reduce(
      (acc, m) => acc + toNumber(m.quantity) * toNumber(m.unitCostSnapshot),
      0
    );

  return (
    <ProjectDetailClient
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
        style: project.style,
        bodyRegion: project.bodyRegion,
        approxSizeCm: project.approxSizeCm,
        stage: project.stage,
        negotiatedAmount: negotiated,
        depositAmount: toNumber(project.depositAmount),
        paidTotal,
        remainingBalance: Math.max(0, negotiated - paidTotal),
        plannedSessions: project.plannedSessions,
        aftercareGuidance: project.aftercareGuidance || "",
        allowPublicPortfolio: project.allowPublicPortfolio,
        hasSignedImageAuth: project.client.documentSignatures.length > 0,
        materialCost,
        client: {
          id: project.client.id,
          fullName: project.client.fullName,
          whatsapp: project.client.whatsapp,
        },
        appointments: project.appointments.map((a) => ({
          id: a.id,
          title: a.title,
          startAt: a.startAt.toISOString(),
          status: a.status,
          sessionNumber: a.sessionNumber,
        })),
        media: project.media.map((m) => ({
          id: m.id,
          fileId: m.fileId,
          kind: m.kind,
          caption: m.caption,
          hasImageConsent: m.hasImageConsent,
          originalName: m.file.originalName,
        })),
        aftercareEntries: project.aftercareEntries.map((e) => ({
          id: e.id,
          dayNumber: e.dayNumber,
          clientObservation: e.clientObservation,
          artistFeedback: e.artistFeedback,
          status: e.status,
          photoFileId: e.photoFileId,
          createdAt: e.createdAt.toISOString(),
        })),
        stockMovements: project.stockMovements.map((m) => ({
          id: m.id,
          itemName: m.stockItem.name,
          unit: m.stockItem.unit,
          quantity: toNumber(m.quantity),
          cost: toNumber(m.quantity) * toNumber(m.unitCostSnapshot),
        })),
        hasPassport: Boolean(project.passport),
      }}
    />
  );
}
