import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";
import { ServicesClient } from "@/components/admin/services-client";

export const dynamic = "force-dynamic";

export default async function AdminServicosPage() {
  await requireAdminPage();

  const [services, categories] = await Promise.all([
    prisma.studioService.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <ServicesClient
      initialServices={services.map((s) => ({
        id: s.id,
        category: s.category,
        name: s.name,
        description: s.description,
        durationMinutes: s.durationMinutes,
        sessionsCount: s.sessionsCount,
        price: toNumber(s.price),
        depositAmount: toNumber(s.depositAmount),
        isActive: s.isActive,
      }))}
      initialCategories={categories.map((c) => ({
        id: c.id,
        name: c.name,
      }))}
    />
  );
}
