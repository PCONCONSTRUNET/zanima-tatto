import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/security/rbac";
import { getPushRuntimeConfig } from "@/lib/push-server";
import { PushAdminClient } from "@/components/admin/push-client";

export const dynamic = "force-dynamic";

export default async function AdminPushPage() {
  const user = await requireAdminPage();
  const [cfg, campaigns, activeClients, activeAdmins] = await Promise.all([
    getPushRuntimeConfig(),
    prisma.marketingCampaign.findMany({
      where: { channel: "PUSH" },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.user.count({ where: { role: "CLIENT", active: true } }),
    prisma.user.count({ where: { role: { in: ["OWNER", "STAFF"] }, active: true } }),
  ]);

  return (
    <PushAdminClient
      currentUser={{ id: user.id, role: user.role }}
      initialConfig={{
        globalEnabled: cfg.globalEnabled,
        adminEnabled: cfg.adminEnabled,
        clientEnabled: cfg.clientEnabled,
        appId: cfg.appId,
        safariWebId: cfg.safariWebId,
        hasRestApiKey: cfg.hasRestApiKey,
        restApiKeyHint: cfg.restApiKeyHint,
        configuredViaEnv: cfg.configuredViaEnv,
        rules: cfg.rules,
      }}
      initialCampaigns={campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        segment: c.segment,
        message: c.message,
        targetCount: c.targetCount,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      }))}
      counts={{ activeClients, activeAdmins }}
    />
  );
}
