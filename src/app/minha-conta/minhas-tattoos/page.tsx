import { prisma } from "@/lib/prisma";
import { requireClientPage } from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";
import { ClientTattoosClient } from "@/components/client/client-tattoos-client";

export const dynamic = "force-dynamic";

export default async function ClientMinhasTattoosPage() {
  const user = await requireClientPage();
  const clientId = user.clientId;

  const [projects, quotes] = clientId
    ? await Promise.all([
        prisma.tattooProject.findMany({
          where: { clientId },
          orderBy: { updatedAt: "desc" },
          include: {
            media: {
              where: { isClientVisible: true },
              include: { file: true },
            },
            payments: {
              where: { status: "CONFIRMED" },
              select: { amount: true },
            },
          },
        }),
        prisma.quoteRequest.findMany({
          where: { clientId },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], []];

  return (
    <ClientTattoosClient
      projects={projects.map((p) => {
        const paid = p.payments.reduce((acc, pay) => acc + toNumber(pay.amount), 0);
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          style: p.style,
          bodyRegion: p.bodyRegion,
          approxSizeCm: p.approxSizeCm,
          stage: p.stage,
          negotiatedAmount: toNumber(p.negotiatedAmount),
          paidAmount: paid,
          aftercareGuidance: p.aftercareGuidance,
          media: p.media.map((m) => ({
            id: m.id,
            fileId: m.fileId,
            kind: m.kind,
            caption: m.caption,
          })),
        };
      })}
      quotes={quotes.map((q) => ({
        id: q.id,
        title: q.title,
        style: q.style,
        bodyRegion: q.bodyRegion,
        approxSizeCm: q.approxSizeCm,
        status: q.status,
        quotedAmount: q.quotedAmount ? toNumber(q.quotedAmount) : null,
        depositAmount: q.depositAmount ? toNumber(q.depositAmount) : null,
        paymentTerms: q.paymentTerms,
        validUntil: q.validUntil ? q.validUntil.toISOString() : null,
        adminNotes: q.adminNotes,
        createdAt: q.createdAt.toISOString(),
      }))}
    />
  );
}
