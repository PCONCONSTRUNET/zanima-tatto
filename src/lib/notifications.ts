import "server-only";
import { prisma } from "@/lib/prisma";
import type { IntegrationProvider, NotificationChannel } from "@prisma/client";

export function isChannelConfiguredByEnv(provider: IntegrationProvider): boolean {
  switch (provider) {
    case "WHATSAPP":
      return Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN);
    case "EMAIL":
      return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    case "PUSH":
      return Boolean(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
      );
    case "MERCADO_PAGO":
      return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
    case "EFI_BANK":
      return Boolean(process.env.EFI_CLIENT_ID && process.env.EFI_CLIENT_SECRET);
  }
}

export async function dispatchNotification(params: {
  recipientUserId: string;
  eventType: string;
  title: string;
  body: string;
  linkUrl?: string;
  channels?: NotificationChannel[];
}) {
  const channels = params.channels ?? ["IN_APP"];
  const created = [];

  for (const channel of channels) {
    if (channel === "IN_APP") {
      created.push(
        await prisma.notification.create({
          data: {
            recipientUserId: params.recipientUserId,
            channel: "IN_APP",
            eventType: params.eventType,
            title: params.title,
            body: params.body,
            linkUrl: params.linkUrl ?? null,
            status: "UNREAD",
          },
        })
      );
      continue;
    }

    const providerMap: Record<Exclude<NotificationChannel, "IN_APP">, IntegrationProvider> = {
      WHATSAPP: "WHATSAPP",
      EMAIL: "EMAIL",
      PUSH: "PUSH",
    };

    const configured = isChannelConfiguredByEnv(providerMap[channel]);
    // Nunca simular envios externos: se a integração não estiver configurada, registra honestamente.
    created.push(
      await prisma.notification.create({
        data: {
          recipientUserId: params.recipientUserId,
          channel,
          eventType: params.eventType,
          title: params.title,
          body: params.body,
          linkUrl: params.linkUrl ?? null,
          status: configured ? "QUEUED" : "SKIPPED_UNCONFIGURED",
        },
      })
    );
  }

  return created;
}

export async function notifyStudioAdmins(params: {
  eventType: string;
  title: string;
  body: string;
  linkUrl?: string;
}) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "STAFF"] }, active: true },
    select: { id: true },
  });
  await Promise.all(
    admins.map((admin) =>
      dispatchNotification({
        recipientUserId: admin.id,
        eventType: params.eventType,
        title: params.title,
        body: params.body,
        linkUrl: params.linkUrl,
        channels: ["IN_APP"],
      })
    )
  );
}
