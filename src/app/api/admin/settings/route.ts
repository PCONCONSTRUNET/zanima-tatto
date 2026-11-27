import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  requireOwnerApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { hashPassword } from "@/lib/security/password";
import { recordAuditLog } from "@/lib/security/audit";
import type { Prisma } from "@prisma/client";

const settingsSchema = z.object({
  action: z.literal("update_studio"),
  studioName: z.string().trim().min(2),
  ownerName: z.string().trim().min(2),
  instagramHandle: z.string().trim().min(2),
  whatsappNumber: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  cityState: z.string().trim().optional(),
  defaultDepositPercent: z.number().int().min(0).max(100),
  cancellationPolicyHours: z.number().int().min(0).max(168),
  heroHeadline: z.string().trim().min(4),
  heroSubheadline: z.string().trim().min(4),
  bioText: z.string().trim().min(4),
});

const createStaffSchema = z.object({
  action: z.literal("create_staff"),
  name: z.string().trim().min(3),
  email: z.string().trim().email(),
  password: z.string().min(8),
  permissions: z.object({
    agenda: z.boolean().default(true),
    clients: z.boolean().default(true),
    projects: z.boolean().default(true),
    quotes: z.boolean().default(true),
    studioFinance: z.boolean().default(false),
    stock: z.boolean().default(true),
    documents: z.boolean().default(true),
    loyalty: z.boolean().default(false),
  }),
});

const lgpdProcessSchema = z.object({
  action: z.literal("process_lgpd"),
  requestId: z.string().min(1),
  decision: z.enum(["COMPLETED", "REJECTED"]),
});

const markNotificationsReadSchema = z.object({
  action: z.literal("mark_notifications_read"),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (body?.action === "mark_notifications_read") {
      const user = await requireAdminApi();
      markNotificationsReadSchema.parse(body);
      await prisma.notification.updateMany({
        where: { recipientUserId: user.id, status: "UNREAD" },
        data: { status: "READ", readAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    if (body?.action === "update_studio") {
      const user = await requireAdminApi("settings");
      const parsed = settingsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
      }
      const d = parsed.data;
      const updated = await prisma.studioSetting.upsert({
        where: { id: "studio-default" },
        update: {
          studioName: d.studioName,
          ownerName: d.ownerName,
          instagramHandle: d.instagramHandle,
          whatsappNumber: d.whatsappNumber || "",
          email: d.email || "",
          address: d.address || "",
          cityState: d.cityState || "",
          defaultDepositPercent: d.defaultDepositPercent,
          cancellationPolicyHours: d.cancellationPolicyHours,
          heroHeadline: d.heroHeadline,
          heroSubheadline: d.heroSubheadline,
          bioText: d.bioText,
        },
        create: {
          id: "studio-default",
          studioName: d.studioName,
          ownerName: d.ownerName,
          instagramHandle: d.instagramHandle,
          whatsappNumber: d.whatsappNumber || "",
          email: d.email || "",
          address: d.address || "",
          cityState: d.cityState || "",
          defaultDepositPercent: d.defaultDepositPercent,
          cancellationPolicyHours: d.cancellationPolicyHours,
          heroHeadline: d.heroHeadline,
          heroSubheadline: d.heroSubheadline,
          bioText: d.bioText,
        },
      });
      await recordAuditLog({
        actorUserId: user.id,
        action: "STUDIO_SETTINGS_UPDATED",
        entityType: "StudioSetting",
        entityId: "studio-default",
      });
      return NextResponse.json({ settings: updated });
    }

    if (body?.action === "create_staff") {
      const owner = await requireOwnerApi();
      const parsed = createStaffSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Dados inválidos." },
          { status: 400 }
        );
      }
      const email = parsed.data.email.toLowerCase();
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) {
        return NextResponse.json(
          { error: "Já existe usuário com este e-mail." },
          { status: 409 }
        );
      }
      // Financeiro pessoal nunca é concedido a STAFF
      const perms = {
        ...parsed.data.permissions,
        personalFinance: false,
        settings: false,
      };
      const staff = await prisma.user.create({
        data: {
          name: parsed.data.name,
          email,
          passwordHash: await hashPassword(parsed.data.password),
          role: "STAFF",
          permissions: perms as Prisma.InputJsonValue,
        },
        select: { id: true, name: true, email: true, role: true },
      });
      await recordAuditLog({
        actorUserId: owner.id,
        action: "STAFF_USER_CREATED",
        entityType: "User",
        entityId: staff.id,
      });
      return NextResponse.json({ staff }, { status: 201 });
    }

    if (body?.action === "process_lgpd") {
      const owner = await requireOwnerApi();
      const parsed = lgpdProcessSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
      }
      const req = await prisma.lgpdRequest.findUnique({
        where: { id: parsed.data.requestId },
      });
      if (!req) {
        return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.lgpdRequest.update({
          where: { id: req.id },
          data: { status: parsed.data.decision, completedAt: new Date() },
        });
        if (
          parsed.data.decision === "COMPLETED" &&
          req.type === "ANONYMIZATION" &&
          req.clientId
        ) {
          await tx.client.update({
            where: { id: req.clientId },
            data: {
              fullName: "Titular Anonimizado (LGPD)",
              phone: "0000000000",
              whatsapp: "0000000000",
              email: null,
              birthDate: null,
              allergiesSummary: null,
              marketingOptIn: false,
              isAnonymized: true,
            },
          });
          if (req.userId) {
            await tx.user.update({
              where: { id: req.userId },
              data: { active: false },
            });
            await tx.authSession.deleteMany({ where: { userId: req.userId } });
          }
        }
      });

      await recordAuditLog({
        actorUserId: owner.id,
        action: "LGPD_REQUEST_PROCESSED",
        entityType: "LgpdRequest",
        entityId: req.id,
        after: { decision: parsed.data.decision },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao processar configurações." },
      { status: 500 }
    );
  }
}
