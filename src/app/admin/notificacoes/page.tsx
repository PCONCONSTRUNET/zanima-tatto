import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/security/rbac";
import { isChannelConfiguredByEnv } from "@/lib/notifications";
import { NotificationsClient } from "@/components/admin/notifications-client";

export const dynamic = "force-dynamic";

export default async function AdminNotificacoesPage() {
  const user = await requireAdminPage();
  const notifications = await prisma.notification.findMany({
    where: { recipientUserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const integrations = [
    {
      name: "WhatsApp Business API",
      configured: isChannelConfiguredByEnv("WHATSAPP"),
      detail: "WHATSAPP_API_URL / WHATSAPP_API_TOKEN",
    },
    {
      name: "E-mail (SMTP)",
      configured: isChannelConfiguredByEnv("EMAIL"),
      detail: "SMTP_HOST / SMTP_USER / SMTP_PASS",
    },
    {
      name: "Web Push (VAPID)",
      configured: isChannelConfiguredByEnv("PUSH"),
      detail: "NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY",
    },
  ];

  return (
    <NotificationsClient
      notifications={notifications.map((n) => ({
        id: n.id,
        eventType: n.eventType,
        channel: n.channel,
        title: n.title,
        body: n.body,
        linkUrl: n.linkUrl,
        status: n.status,
        createdAt: n.createdAt.toISOString(),
      }))}
      integrations={integrations}
    />
  );
}
