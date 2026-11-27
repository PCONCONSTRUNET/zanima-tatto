import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientPage } from "@/lib/security/rbac";
import { AftercareClient } from "@/components/client/aftercare-client";

export const dynamic = "force-dynamic";

export default async function ClientAftercarePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await requireClientPage();
  const { projectId } = await params;

  const project = await prisma.tattooProject.findUnique({
    where: { id: projectId },
    include: {
      aftercareEntries: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project || project.clientId !== user.clientId) notFound();

  return (
    <AftercareClient
      project={{
        id: project.id,
        name: project.name,
        aftercareGuidance: project.aftercareGuidance || "",
        entries: project.aftercareEntries.map((e) => ({
          id: e.id,
          dayNumber: e.dayNumber,
          clientObservation: e.clientObservation,
          artistFeedback: e.artistFeedback,
          status: e.status,
          photoFileId: e.photoFileId,
          createdAt: e.createdAt.toISOString(),
        })),
      }}
    />
  );
}
