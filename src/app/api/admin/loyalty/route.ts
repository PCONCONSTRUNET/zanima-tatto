import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";

const couponSchema = z.object({
  entity: z.literal("coupon"),
  code: z.string().trim().min(3),
  description: z.string().trim().min(2),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.number().positive(),
  maxUses: z.number().int().positive().optional().nullable(),
});

const voucherSchema = z.object({
  entity: z.literal("voucher"),
  purchaserName: z.string().trim().min(2),
  recipientName: z.string().trim().min(2),
  recipientContact: z.string().trim().optional(),
  amount: z.number().positive(),
});

const flashSchema = z.object({
  entity: z.literal("flash"),
  title: z.string().trim().min(2),
  description: z.string().trim().optional(),
  style: z.string().trim().min(2),
  suggestedRegion: z.string().trim().min(2),
  approxSizeCm: z.string().trim().min(1),
  price: z.number().positive(),
  imageFileId: z.string().optional().nullable(),
});

const waitlistSchema = z.object({
  entity: z.literal("waitlist"),
  name: z.string().trim().min(2),
  contact: z.string().trim().min(5),
  preferredStyle: z.string().trim().min(2),
  preferredDays: z.string().trim().optional(),
});

const campaignSchema = z.object({
  entity: z.literal("campaign"),
  title: z.string().trim().min(2),
  segment: z.string().trim().min(2),
  message: z.string().trim().min(5),
  channel: z.enum(["WHATSAPP", "EMAIL"]),
});

const referralSchema = z.object({
  entity: z.literal("referral"),
  referrerClientId: z.string().min(1),
  referredName: z.string().trim().min(2),
  referredContact: z.string().trim().min(5),
  rewardDescription: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdminApi("loyalty");
    const body = await request.json().catch(() => null);

    if (body?.entity === "coupon") {
      const parsed = couponSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Cupom inválido." }, { status: 400 });
      }
      const coupon = await prisma.coupon.create({
        data: {
          code: parsed.data.code.toUpperCase(),
          description: parsed.data.description,
          discountType: parsed.data.discountType,
          discountValue: parsed.data.discountValue,
          maxUses: parsed.data.maxUses ?? null,
        },
      });
      return NextResponse.json({ coupon }, { status: 201 });
    }

    if (body?.entity === "voucher") {
      const parsed = voucherSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Vale-presente inválido." }, { status: 400 });
      }
      const code = `VP-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const voucher = await prisma.giftVoucher.create({
        data: {
          code,
          purchaserName: parsed.data.purchaserName,
          recipientName: parsed.data.recipientName,
          recipientContact: parsed.data.recipientContact || null,
          amount: parsed.data.amount,
          balance: parsed.data.amount,
        },
      });
      return NextResponse.json({ voucher }, { status: 201 });
    }

    if (body?.entity === "flash") {
      const parsed = flashSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Desenho inválido." }, { status: 400 });
      }
      const flash = await prisma.exclusiveFlashDesign.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description || null,
          style: parsed.data.style,
          suggestedRegion: parsed.data.suggestedRegion,
          approxSizeCm: parsed.data.approxSizeCm,
          price: parsed.data.price,
          imageFileId: parsed.data.imageFileId || null,
        },
      });
      return NextResponse.json({ flash }, { status: 201 });
    }

    if (body?.entity === "waitlist") {
      const parsed = waitlistSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
      }
      const entry = await prisma.waitlistEntry.create({
        data: {
          name: parsed.data.name,
          contact: parsed.data.contact,
          preferredStyle: parsed.data.preferredStyle,
          preferredDays: parsed.data.preferredDays || null,
        },
      });
      return NextResponse.json({ entry }, { status: 201 });
    }

    if (body?.entity === "referral") {
      const parsed = referralSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
      }
      const referral = await prisma.referral.create({
        data: {
          referrerClientId: parsed.data.referrerClientId,
          referredName: parsed.data.referredName,
          referredContact: parsed.data.referredContact,
          rewardDescription: parsed.data.rewardDescription || null,
        },
      });
      return NextResponse.json({ referral }, { status: 201 });
    }

    if (body?.entity === "campaign") {
      const parsed = campaignSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Campanha inválida." }, { status: 400 });
      }
      // Respeita estritamente marketingOptIn === true
      const optedInCount = await prisma.client.count({
        where: { marketingOptIn: true, isAnonymized: false },
      });
      const campaign = await prisma.marketingCampaign.create({
        data: {
          title: parsed.data.title,
          segment: parsed.data.segment,
          message: parsed.data.message,
          channel: parsed.data.channel,
          targetCount: optedInCount,
          status: "DRAFT",
        },
      });
      return NextResponse.json({ campaign }, { status: 201 });
    }

    return NextResponse.json({ error: "Entidade inválida." }, { status: 400 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao salvar item de fidelização." },
      { status: 500 }
    );
  }
}
