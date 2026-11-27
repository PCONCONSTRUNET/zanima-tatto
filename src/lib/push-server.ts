import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  DEFAULT_PUSH_SETTINGS,
  getDefaultPushRules,
  type PushEventRuleKey,
  type PushRuleToggle,
  type PushSettingsPayload,
} from "@/lib/push-config";

export interface PushRuntimeConfig extends PushSettingsPayload {
  restApiKey: string;
  hasRestApiKey: boolean;
  restApiKeyHint: string | null;
  configuredViaEnv: boolean;
}

function maskKey(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 10) return "••••••••";
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}

function resolveBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://zanimatatto.vercel.app";
  return raw.replace(/\/+$/, "");
}

export function resolvePushTargetUrl(linkUrl?: string | null): string | undefined {
  if (!linkUrl) return resolveBaseUrl();
  if (linkUrl.startsWith("http://") || linkUrl.startsWith("https://")) {
    return linkUrl;
  }
  const normalized = linkUrl.startsWith("/") ? linkUrl : `/${linkUrl}`;
  return `${resolveBaseUrl()}${normalized}`;
}

export async function getPushRuntimeConfig(): Promise<PushRuntimeConfig> {
  const row = await prisma.notificationChannelConfig
    .findUnique({ where: { provider: "PUSH" } })
    .catch(() => null);

  const summary =
    row &&
    typeof row.configSummaryJson === "object" &&
    row.configSummaryJson !== null &&
    !Array.isArray(row.configSummaryJson)
      ? (row.configSummaryJson as Record<string, unknown>)
      : {};

  const initialized = Boolean(summary.initialized);

  const envAppId =
    process.env.ONESIGNAL_APP_ID?.trim() ||
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim() ||
    "";
  const envSafariId =
    process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID?.trim() || "";
  const envRestKey = process.env.ONESIGNAL_REST_API_KEY?.trim() || "";

  const dbAppId = typeof summary.appId === "string" ? summary.appId.trim() : "";
  const dbSafariId =
    typeof summary.safariWebId === "string" ? summary.safariWebId.trim() : "";
  const dbRestKey =
    typeof summary.restApiKey === "string" ? summary.restApiKey.trim() : "";

  const appId = dbAppId || envAppId;
  const safariWebId = dbSafariId || envSafariId;
  const restApiKey = dbRestKey || envRestKey;

  const defaultRules = getDefaultPushRules();
  const rawRules =
    typeof summary.rules === "object" &&
    summary.rules !== null &&
    !Array.isArray(summary.rules)
      ? (summary.rules as Record<string, unknown>)
      : {};

  const mergedRules: Record<PushEventRuleKey, PushRuleToggle> = {
    ...defaultRules,
  };
  for (const key of Object.keys(defaultRules) as PushEventRuleKey[]) {
    const item = rawRules[key];
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const r = item as Record<string, unknown>;
      mergedRules[key] = {
        client:
          typeof r.client === "boolean" ? r.client : defaultRules[key].client,
        admin: typeof r.admin === "boolean" ? r.admin : defaultRules[key].admin,
      };
    }
  }

  return {
    globalEnabled: initialized
      ? Boolean(row?.isEnabled)
      : DEFAULT_PUSH_SETTINGS.globalEnabled,
    adminEnabled:
      typeof summary.adminEnabled === "boolean"
        ? summary.adminEnabled
        : DEFAULT_PUSH_SETTINGS.adminEnabled,
    clientEnabled:
      typeof summary.clientEnabled === "boolean"
        ? summary.clientEnabled
        : DEFAULT_PUSH_SETTINGS.clientEnabled,
    appId,
    safariWebId,
    rules: mergedRules,
    restApiKey,
    hasRestApiKey: Boolean(restApiKey),
    restApiKeyHint: maskKey(restApiKey),
    configuredViaEnv: Boolean(envAppId && envRestKey),
  };
}

export async function savePushConfig(input: {
  globalEnabled: boolean;
  adminEnabled: boolean;
  clientEnabled: boolean;
  appId?: string;
  safariWebId?: string;
  restApiKey?: string;
  rules: Record<PushEventRuleKey, PushRuleToggle>;
}) {
  const current = await getPushRuntimeConfig();
  const nextAppId =
    input.appId !== undefined ? input.appId.trim() : current.appId;
  const nextSafariId =
    input.safariWebId !== undefined
      ? input.safariWebId.trim()
      : current.safariWebId;
  const nextRestKey =
    input.restApiKey && input.restApiKey.trim().length > 0
      ? input.restApiKey.trim()
      : current.restApiKey;

  const isConfigured = Boolean(nextAppId && nextRestKey);
  const summaryJson: Prisma.InputJsonValue = {
    initialized: true,
    adminEnabled: input.adminEnabled,
    clientEnabled: input.clientEnabled,
    appId: nextAppId,
    safariWebId: nextSafariId,
    restApiKey: nextRestKey,
    rules: input.rules as unknown as Prisma.InputJsonObject,
  };

  await prisma.notificationChannelConfig.upsert({
    where: { provider: "PUSH" },
    update: {
      isEnabled: input.globalEnabled,
      isConfigured,
      configSummaryJson: summaryJson,
    },
    create: {
      provider: "PUSH",
      isEnabled: input.globalEnabled,
      isConfigured,
      configSummaryJson: summaryJson,
    },
  });

  return getPushRuntimeConfig();
}

async function callOneSignalApi(params: {
  appId: string;
  restApiKey: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean; id?: string; recipients?: number; error?: string }> {
  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Key ${params.restApiKey}`,
      },
      body: JSON.stringify({
        app_id: params.appId,
        target_channel: "push",
        ...params.payload,
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      id?: string;
      recipients?: number;
      errors?: unknown;
    } | null;

    if (!res.ok) {
      return {
        ok: false,
        error: data?.errors ? JSON.stringify(data.errors) : `HTTP ${res.status}`,
      };
    }

    return {
      ok: true,
      id: data?.id,
      recipients: data?.recipients,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro de conexão com OneSignal",
    };
  }
}

export async function sendOneSignalPushToUsers(params: {
  userIds: string[];
  title: string;
  body: string;
  linkUrl?: string | null;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string; id?: string }> {
  const uniqueIds = Array.from(new Set(params.userIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { ok: false, skipped: true };
  }

  const config = await getPushRuntimeConfig();
  if (!config.globalEnabled || !config.appId || !config.restApiKey) {
    return { ok: false, skipped: true };
  }

  const url = resolvePushTargetUrl(params.linkUrl);
  // OneSignal aceita até 20.000 external_ids por requisição; fatiamos em 1000 para segurança
  let lastResult: { ok: boolean; error?: string; id?: string } = { ok: true };
  for (let i = 0; i < uniqueIds.length; i += 1000) {
    const chunk = uniqueIds.slice(i, i + 1000);
    const res = await callOneSignalApi({
      appId: config.appId,
      restApiKey: config.restApiKey,
      payload: {
        include_aliases: { external_id: chunk },
        headings: { pt: params.title, en: params.title },
        contents: { pt: params.body, en: params.body },
        ...(url ? { url } : {}),
      },
    });
    lastResult = res;
  }
  return lastResult;
}

export async function sendOneSignalBroadcast(params: {
  target: "ALL" | "CLIENTS" | "ADMINS";
  title: string;
  body: string;
  linkUrl?: string | null;
}): Promise<{
  ok: boolean;
  oneSignalId?: string;
  inAppCount: number;
  error?: string;
}> {
  const config = await getPushRuntimeConfig();
  if (!config.appId || !config.restApiKey) {
    return {
      ok: false,
      inAppCount: 0,
      error: "OneSignal App ID ou REST API Key não configurados.",
    };
  }

  const url = resolvePushTargetUrl(params.linkUrl);

  const users = await prisma.user.findMany({
    where: {
      active: true,
      ...(params.target === "CLIENTS"
        ? { role: "CLIENT" }
        : params.target === "ADMINS"
          ? { role: { in: ["OWNER", "STAFF"] } }
          : {}),
    },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  let pushResult: {
    ok: boolean;
    id?: string;
    recipients?: number;
    error?: string;
  };

  if (params.target === "ALL") {
    pushResult = await callOneSignalApi({
      appId: config.appId,
      restApiKey: config.restApiKey,
      payload: {
        included_segments: ["Total Subscriptions"],
        headings: { pt: params.title, en: params.title },
        contents: { pt: params.body, en: params.body },
        ...(url ? { url } : {}),
      },
    });
    if (!pushResult.ok) {
      pushResult = await callOneSignalApi({
        appId: config.appId,
        restApiKey: config.restApiKey,
        payload: {
          included_segments: ["Subscribed Users"],
          headings: { pt: params.title, en: params.title },
          contents: { pt: params.body, en: params.body },
          ...(url ? { url } : {}),
        },
      });
    }
  } else {
    pushResult = await sendOneSignalPushToUsers({
      userIds,
      title: params.title,
      body: params.body,
      linkUrl: params.linkUrl,
    });
  }

  if (userIds.length > 0) {
    await prisma.notification.createMany({
      data: userIds.map((uid) => ({
        recipientUserId: uid,
        channel: "IN_APP" as const,
        eventType: "MANUAL_BROADCAST",
        title: params.title,
        body: params.body,
        linkUrl: params.linkUrl || null,
        status: "UNREAD" as const,
      })),
    });
  }

  await prisma.marketingCampaign.create({
    data: {
      title: params.title,
      segment: params.target,
      message: params.body,
      channel: "PUSH",
      targetCount: userIds.length,
      status: pushResult.ok ? "SENT" : "FAILED",
    },
  });

  return {
    ok: pushResult.ok,
    oneSignalId: pushResult.id,
    inAppCount: userIds.length,
    error: pushResult.error,
  };
}
