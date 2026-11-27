import { prisma } from "@/lib/prisma";
import { requireClientPage } from "@/lib/security/rbac";
import { NextTattooClient } from "@/components/client/next-tattoo-client";

export const dynamic = "force-dynamic";

export default async function MinhaProximaTattooPage() {
  const user = await requireClientPage();
  const ideas = user.clientId
    ? await prisma.futureTattooIdea.findMany({
        where: { clientId: user.clientId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <NextTattooClient
      initialIdeas={ideas.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        style: i.style,
        bodyRegion: i.bodyRegion,
        approxSizeCm: i.approxSizeCm,
        referenceFileIds: i.referenceFileIds,
        convertedQuoteId: i.convertedQuoteId,
        createdAt: i.createdAt.toISOString(),
      }))}
    />
  );
}
