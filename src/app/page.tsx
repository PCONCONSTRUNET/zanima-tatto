import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/security/session";
import { PublicEntryView } from "@/components/public/public-entry-view";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const now = new Date();
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(now);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdayMap[weekdayName] ?? 1;

  const [user, settings, todayRule] = await Promise.all([
    getCurrentUser(),
    prisma.studioSetting.findUnique({ where: { id: "studio-default" } }),
    prisma.availabilityRule.findUnique({ where: { dayOfWeek } }),
  ]);

  const clientUser =
    user && user.role === "CLIENT" ? { name: user.name } : null;
  const igHandle = settings?.instagramHandle || "@zanima_tattoo";
  const igSlug = igHandle.replace(/^@/, "");
  const waRaw = settings?.whatsappNumber || "";
  const waClean = waRaw.replace(/\D/g, "");

  const isOpenToday = Boolean(todayRule?.isActive);
  const todayHours = isOpenToday
    ? `Atendimento hoje • ${todayRule!.startTime}–${todayRule!.endTime}`
    : "Atendimento com hora marcada";

  return (
    <PublicEntryView
      studioName={settings?.studioName || "ZANIMA TATTOO"}
      ownerName={settings?.ownerName || "Leticia Zanini Macalossi"}
      igHandle={igHandle}
      igSlug={igSlug}
      waRaw={waRaw}
      waClean={waClean}
      isOpenToday={isOpenToday}
      todayHours={todayHours}
      user={clientUser}
    />
  );
}
