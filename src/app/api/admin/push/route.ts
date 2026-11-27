import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { recordAuditLog } from "@/lib/security/audit";
import {
  getPushRuntimeConfig,
  savePushConfig,
  sendOneSignalBroadcast,
  sendOneSignalPushToUsers,
} from "@/lib/push-server";

const ruleToggleSchema = z.object({
  client: z.boolean(),
  admin: z.boolean(),
});

const saveConfigSchema = z.object({
  globalEnabled: z.boolean(),
  adminEnabled: z.boolean(),
  clientEnabled: z.boolean(),
  appId: z.string().trim().optional(),
  safariWebId: z.string().trim().optional(),
  restApiKey: z.string().trim().optional(),
  rules: z.object({
    BOOKING_CONFIRMED_CLIENT: ruleToggleSchema,
    APPOINTMENT_CANCELLED: ruleToggleSchema,
    CLIENT_NO_SHOW: ruleToggleSchema,
    CLIENT_MARKED_PAID: ruleToggleSchema,
    ADMIN_PAYMENT_REGISTERED: ruleToggleSchema,
  }),
});

const postActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("broadcast"),
    title: z.string().trim().min(2, "Informe o título da notificação.").max(120),
    body: z.string().trim().min(2, "Informe a mensagem.").max(400),
    linkUrl: z.string().trim().optional(),
    target: z.enum(["ALL", "CLIENTS", "ADMINS"]).default("ALL"),
  }),
  z.object({
    action: z.literal("test_self"),
  }),
]);

export async function GET() {
  try {
    await requireAdminApi("settings");
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

    return NextResponse.json({
      config: {
        globalEnabled: cfg.globalEnabled,
        adminEnabled: cfg.adminEnabled,
        clientEnabled: cfg.clientEnabled,
        appId: cfg.appId,
        safariWebId: cfg.safariWebId,
        hasRestApiKey: cfg.hasRestApiKey,
        restApiKeyHint: cfg.restApiKeyHint,
        configuredViaEnv: cfg.configuredViaEnv,
        rules: cfg.rules,
      },
      campaigns,
      counts: { activeClients, activeAdmins },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao carregar configurações de Push." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAdminApi("settings");
    const body = await request.json().catch(() => null);
    const parsed = saveConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const updated = await savePushConfig(parsed.data);

    await recordAuditLog({
      actorUserId: user.id,
      action: "PUSH_CONFIG_UPDATED",
      entityType: "NotificationChannelConfig",
      entityId: "PUSH",
      after: {
        globalEnabled: updated.globalEnabled,
        adminEnabled: updated.adminEnabled,
        clientEnabled: updated.clientEnabled,
        rules: updated.rules,
      },
    });

    return NextResponse.json({
      config: {
        globalEnabled: updated.globalEnabled,
        adminEnabled: updated.adminEnabled,
        clientEnabled: updated.clientEnabled,
        appId: updated.appId,
        safariWebId: updated.safariWebId,
        hasRestApiKey: updated.hasRestApiKey,
        restApiKeyHint: updated.restApiKeyHint,
        configuredViaEnv: updated.configuredViaEnv,
        rules: updated.rules,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao salvar configurações de Push." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi("settings");
    const body = await request.json().catch(() => null);
    const parsed = postActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    if (parsed.data.action === "test_self") {
      const res = await sendOneSignalPushToUsers({
        userIds: [user.id],
        title: "Teste Push ZANIMA Admin",
        body: "Notificações Push configuradas e funcionando neste dispositivo.",
        linkUrl: "/admin/push",
      });

      if (!res.ok) {
        return NextResponse.json(
          {
            error:
              res.error ||
              (res.skipped
                ? "Push global desativado ou chaves OneSignal ausentes."
                : "Falha ao enviar teste ao OneSignal."),
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: true, id: res.id });
    }

    const d = parsed.data;
    const result = await sendOneSignalBroadcast({
      target: d.target,
      title: d.title,
      body: d.body,
      linkUrl: d.linkUrl || "/",
    });

    await recordAuditLog({
      actorUserId: user.id,
      action: "PUSH_MANUAL_BROADCAST",
      entityType: "MarketingCampaign",
      entityId: result.oneSignalId || "push",
      after: { target: d.target, title: d.title, inAppCount: result.inAppCount, ok: result.ok },
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.error ||
            "Notificação registrada internamente, mas o OneSignal retornou erro no envio Push.",
          inAppCount: result.inAppCount,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      oneSignalId: result.oneSignalId,
      inAppCount: result.inAppCount,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao processar envio Push." },
      { status: 500 }
    );
  }
}
