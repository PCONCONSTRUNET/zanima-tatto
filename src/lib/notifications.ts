import "server-only";
import { prisma } from "@/lib/prisma";
import type { IntegrationProvider, NotificationChannel } from "@prisma/client";
import type { PushEventRuleKey } from "@/lib/push-config";
import {
  getPushRuntimeConfig,
  sendOneSignalPushToUsers,
} from "@/lib/push-server";

export function isChannelConfiguredByEnv(provider: IntegrationProvider): boolean {
  switch (provider) {
    case "WHATSAPP":
      return Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN);
    case "EMAIL":
      return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    case "PUSH":
      return Boolean(
        (process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) &&
          process.env.ONESIGNAL_REST_API_KEY
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

    if (channel === "PUSH") {
      const pushRes = await sendOneSignalPushToUsers({
        userIds: [params.recipientUserId],
        title: params.title,
        body: params.body,
        linkUrl: params.linkUrl,
      });

      created.push(
        await prisma.notification.create({
          data: {
            recipientUserId: params.recipientUserId,
            channel: "PUSH",
            eventType: params.eventType,
            title: params.title,
            body: params.body,
            linkUrl: params.linkUrl ?? null,
            status: pushRes.skipped
              ? "SKIPPED_UNCONFIGURED"
              : pushRes.ok
                ? "QUEUED"
                : "FAILED",
          },
        })
      );
      continue;
    }

    const providerMap: Record<
      Exclude<NotificationChannel, "IN_APP" | "PUSH">,
      IntegrationProvider
    > = {
      WHATSAPP: "WHATSAPP",
      EMAIL: "EMAIL",
    };

    const configured = isChannelConfiguredByEnv(providerMap[channel]);
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

export async function dispatchPushEvent(params: {
  rule: PushEventRuleKey;
  target: "CLIENT" | "ADMIN";
  userIds: string[];
  title: string;
  body: string;
  linkUrl?: string;
}) {
  const uniqueIds = Array.from(new Set(params.userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const config = await getPushRuntimeConfig();
  if (!config.globalEnabled) return;
  if (params.target === "ADMIN" && !config.adminEnabled) return;
  if (params.target === "CLIENT" && !config.clientEnabled) return;

  const ruleCfg = config.rules[params.rule];
  if (!ruleCfg) return;
  const enabledForTarget =
    params.target === "ADMIN" ? ruleCfg.admin : ruleCfg.client;
  if (!enabledForTarget) return;

  const pushRes = await sendOneSignalPushToUsers({
    userIds: uniqueIds,
    title: params.title,
    body: params.body,
    linkUrl: params.linkUrl,
  });

  await prisma.notification
    .createMany({
      data: uniqueIds.map((uid) => ({
        recipientUserId: uid,
        channel: "PUSH" as const,
        eventType: params.rule,
        title: params.title,
        body: params.body,
        linkUrl: params.linkUrl ?? null,
        status: pushRes.skipped
          ? ("SKIPPED_UNCONFIGURED" as const)
          : pushRes.ok
            ? ("QUEUED" as const)
            : ("FAILED" as const),
      })),
    })
    .catch(() => {});
}

export async function notifyStudioAdmins(params: {
  eventType: string;
  title: string;
  body: string;
  linkUrl?: string;
  pushRule?: PushEventRuleKey;
}) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "STAFF"] }, active: true },
    select: { id: true },
  });
  const adminIds = admins.map((a) => a.id);

  await Promise.all(
    adminIds.map((adminId) =>
      dispatchNotification({
        recipientUserId: adminId,
        eventType: params.eventType,
        title: params.title,
        body: params.body,
        linkUrl: params.linkUrl,
        channels: ["IN_APP"],
      })
    )
  );

  if (params.pushRule) {
    await dispatchPushEvent({
      rule: params.pushRule,
      target: "ADMIN",
      userIds: adminIds,
      title: params.title,
      body: params.body,
      linkUrl: params.linkUrl,
    });
  }
}
