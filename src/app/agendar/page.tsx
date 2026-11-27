import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { getCurrentUser } from "@/lib/security/session";
import { STUDIO_OWNER_WHATSAPP, STUDIO_PIX_KEY } from "@/lib/pix";
import { BookingWizardClient } from "@/components/public/booking-wizard-client";

export const dynamic = "force-dynamic";

export default async function AgendarOnlinePage() {
  const [services, sessionUser, setting] = await Promise.all([
    prisma.studioService.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    getCurrentUser(),
    prisma.studioSetting.findFirst({ select: { whatsappNumber: true } }),
  ]);

  const linkedClient = sessionUser?.clientId
    ? await prisma.client.findUnique({
        where: { id: sessionUser.clientId },
        select: { fullName: true, whatsapp: true, email: true },
      })
    : null;

  return (
    <BookingWizardClient
      services={services.map((s) => ({
        id: s.id,
        category: s.category,
        name: s.name,
        description: s.description,
        durationMinutes: s.durationMinutes,
        sessionsCount: s.sessionsCount,
        price: toNumber(s.price),
        depositAmount: toNumber(s.depositAmount),
      }))}
      studioWhatsapp={STUDIO_OWNER_WHATSAPP}
      pixKey={STUDIO_PIX_KEY}
      prefillClient={{
        isLoggedIn: Boolean(sessionUser),
        fullName: linkedClient?.fullName || sessionUser?.name || "",
        whatsapp: linkedClient?.whatsapp || "",
        email: linkedClient?.email || sessionUser?.email || "",
      }}
    />
  );
}
