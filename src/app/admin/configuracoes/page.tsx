import { prisma } from "@/lib/prisma";
import { canAccessPersonalFinance, requireAdminPage } from "@/lib/security/rbac";
import { isChannelConfiguredByEnv } from "@/lib/notifications";
import { SettingsClient } from "@/components/admin/settings-client";

export const dynamic = "force-dynamic";

export default async function AdminConfiguracoesPage() {
  const user = await requireAdminPage();
  const isOwner = canAccessPersonalFinance(user);

  const [settings, staffUsers, lgpdRequests, auditLogs, clients, studioAccounts] =
    await Promise.all([
      prisma.studioSetting.findUnique({ where: { id: "studio-default" } }),
      isOwner
        ? prisma.user.findMany({
            where: { role: { in: ["OWNER", "STAFF"] } },
            select: { id: true, name: true, email: true, role: true, active: true },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
      isOwner
        ? prisma.lgpdRequest.findMany({
            orderBy: { requestedAt: "desc" },
            take: 20,
            include: { client: { select: { fullName: true } } },
          })
        : Promise.resolve([]),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { actor: { select: { name: true } } },
      }),
      prisma.client.findMany({
        where: { isAnonymized: false },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true },
      }),
      prisma.financialAccount.findMany({
        where: { context: "STUDIO", isActive: true },
        select: { id: true, name: true },
      }),
    ]);

  return (
    <SettingsClient
      isOwner={isOwner}
      settings={{
        studioName: settings?.studioName || "ZANIMA TATTOO",
        ownerName: settings?.ownerName || "Leticia Zanini Macalossi",
        instagramHandle: settings?.instagramHandle || "@zanima_tattoo",
        whatsappNumber: settings?.whatsappNumber || "",
        email: settings?.email || "",
        address: settings?.address || "",
        cityState: settings?.cityState || "Brasil",
        defaultDepositPercent: settings?.defaultDepositPercent ?? 30,
        cancellationPolicyHours: settings?.cancellationPolicyHours ?? 48,
        heroHeadline:
          settings?.heroHeadline ||
          "Traços finos com intenção, leveza e permanência.",
        heroSubheadline:
          settings?.heroSubheadline ||
          "Estúdio especializado em Fine Line, Floral e Minimalista.",
        bioText: settings?.bioText || "",
      }}
      gateways={[
        {
          name: "Mercado Pago",
          configured: isChannelConfiguredByEnv("MERCADO_PAGO"),
          webhookPath: "/api/payments/webhook/mercado-pago",
        },
        {
          name: "Efí Bank (Gerencianet)",
          configured: isChannelConfiguredByEnv("EFI_BANK"),
          webhookPath: "/api/payments/webhook/efi-bank",
        },
      ]}
      staffUsers={staffUsers}
      lgpdRequests={lgpdRequests.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        clientName: r.client?.fullName || "Titular",
        requestedAt: r.requestedAt.toISOString(),
        notes: r.notes,
      }))}
      auditLogs={auditLogs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        actorName: l.actor?.name || "Sistema",
        createdAt: l.createdAt.toISOString(),
      }))}
      clients={clients}
      studioAccounts={studioAccounts.map((a) => ({ id: a.id, name: a.name }))}
    />
  );
}
