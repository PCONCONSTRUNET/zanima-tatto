import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/security/rbac";
import { toISODateSP, toNumber } from "@/lib/format";
import { QuotesClient } from "@/components/admin/quotes-client";

export const dynamic = "force-dynamic";

export default async function AdminOrcamentosPage() {
  await requireAdminPage();

  const [quotes, clients] = await Promise.all([
    prisma.quoteRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, fullName: true, whatsapp: true, email: true } },
        convertedProject: { select: { id: true, name: true } },
      },
    }),
    prisma.client.findMany({
      where: { isAnonymized: false },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, whatsapp: true, phone: true },
    }),
  ]);

  return (
    <QuotesClient
      todayStr={toISODateSP()}
      initialQuotes={quotes.map((q) => ({
        id: q.id,
        clientId: q.clientId,
        clientName: q.client.fullName,
        clientWhatsapp: q.client.whatsapp,
        title: q.title,
        ideaDescription: q.ideaDescription,
        style: q.style,
        bodyRegion: q.bodyRegion,
        approxSizeCm: q.approxSizeCm,
        availabilityText: q.availabilityText,
        clientNotes: q.clientNotes,
        referenceFileIds: q.referenceFileIds,
        status: q.status,
        quotedAmount: q.quotedAmount ? toNumber(q.quotedAmount) : null,
        depositAmount: q.depositAmount ? toNumber(q.depositAmount) : null,
        paymentTerms: q.paymentTerms,
        validUntil: q.validUntil ? q.validUntil.toISOString().slice(0, 10) : null,
        adminNotes: q.adminNotes,
        convertedProjectId: q.convertedProjectId,
        createdAt: q.createdAt.toISOString(),
      }))}
      clients={clients}
    />
  );
}
