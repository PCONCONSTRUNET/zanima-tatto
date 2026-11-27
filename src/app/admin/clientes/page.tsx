import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/security/rbac";
import { ClientsListClient } from "@/components/admin/clients-client";

export const dynamic = "force-dynamic";

export default async function AdminClientesPage() {
  await requireAdminPage();

  const [clients, linkRequests] = await Promise.all([
    prisma.client.findMany({
      where: { isAnonymized: false },
      orderBy: { fullName: "asc" },
      include: {
        _count: {
          select: {
            appointments: true,
            projects: true,
            quoteRequests: true,
            documentSignatures: true,
          },
        },
      },
    }),
    prisma.clientLinkRequest.findMany({
      where: { status: "PENDING" },
      include: {
        user: { select: { name: true, email: true } },
        targetClient: { select: { id: true, fullName: true, whatsapp: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <ClientsListClient
      initialClients={clients.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        whatsapp: c.whatsapp,
        email: c.email,
        hasAccount: Boolean(c.userId),
        verificationCode: c.identityVerificationCode,
        preferredStyles: c.preferredStyles,
        counts: c._count,
      }))}
      initialLinkRequests={linkRequests.map((lr) => ({
        id: lr.id,
        targetClientId: lr.targetClientId,
        targetName: lr.targetClient.fullName,
        userName: lr.user.name,
        userEmail: lr.user.email,
        providedPhone: lr.providedPhone,
      }))}
    />
  );
}
