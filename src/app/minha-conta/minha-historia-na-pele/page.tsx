import { prisma } from "@/lib/prisma";
import { requireClientPage } from "@/lib/security/rbac";
import { PassportClient } from "@/components/client/passport-client";

export const dynamic = "force-dynamic";

export default async function MinhaHistoriaNaPelePage() {
  const user = await requireClientPage();
  const passports = user.clientId
    ? await prisma.tattooPassport.findMany({
        where: { clientId: user.clientId },
        orderBy: { completedDate: "desc" },
        include: {
          project: {
            select: {
              aftercareGuidance: true,
              media: {
                where: { kind: "RESULT_PHOTO", isClientVisible: true },
                take: 1,
                select: { fileId: true },
              },
            },
          },
        },
      })
    : [];

  return (
    <PassportClient
      clientName={user.name}
      passports={passports.map((p) => ({
        id: p.id,
        projectId: p.projectId,
        title: p.title,
        completedDate: p.completedDate.toISOString(),
        style: p.style,
        bodyRegion: p.bodyRegion,
        clientMeaning: p.clientMeaning || "",
        sessionsCount: p.sessionsCount,
        careSummary: p.careSummary || p.project.aftercareGuidance || "",
        featuredFileId: p.featuredFileId || p.project.media[0]?.fileId || null,
        touchUps: Array.isArray(p.touchUpHistoryJson)
          ? (p.touchUpHistoryJson as Array<{
              date: string;
              notes: string;
              recordedBy?: string;
            }>)
          : [],
      }))}
    />
  );
}
