import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";
import { LoyaltyClient } from "@/components/admin/loyalty-client";

export const dynamic = "force-dynamic";

export default async function AdminFidelizacaoPage() {
  await requireAdminPage();

  const [coupons, vouchers, flashes, waitlist, referrals, campaigns, clients] =
    await Promise.all([
      prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.giftVoucher.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.exclusiveFlashDesign.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.referral.findMany({
        orderBy: { createdAt: "desc" },
        include: { referrerClient: { select: { fullName: true } } },
      }),
      prisma.marketingCampaign.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.client.findMany({
        where: { isAnonymized: false },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true, marketingOptIn: true },
      }),
    ]);

  return (
    <LoyaltyClient
      coupons={coupons.map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        discountType: c.discountType,
        discountValue: toNumber(c.discountValue),
        usedCount: c.usedCount,
        maxUses: c.maxUses,
      }))}
      vouchers={vouchers.map((v) => ({
        id: v.id,
        code: v.code,
        purchaserName: v.purchaserName,
        recipientName: v.recipientName,
        amount: toNumber(v.amount),
        balance: toNumber(v.balance),
        status: v.status,
      }))}
      flashes={flashes.map((f) => ({
        id: f.id,
        title: f.title,
        style: f.style,
        suggestedRegion: f.suggestedRegion,
        approxSizeCm: f.approxSizeCm,
        price: toNumber(f.price),
        status: f.status,
      }))}
      waitlist={waitlist.map((w) => ({
        id: w.id,
        name: w.name,
        contact: w.contact,
        preferredStyle: w.preferredStyle,
        preferredDays: w.preferredDays,
        status: w.status,
      }))}
      referrals={referrals.map((r) => ({
        id: r.id,
        referrerName: r.referrerClient.fullName,
        referredName: r.referredName,
        referredContact: r.referredContact,
        status: r.status,
        rewardDescription: r.rewardDescription,
      }))}
      campaigns={campaigns.map((cp) => ({
        id: cp.id,
        title: cp.title,
        channel: cp.channel,
        targetCount: cp.targetCount,
        status: cp.status,
      }))}
      clients={clients}
    />
  );
}
