import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";
import { StockClient } from "@/components/admin/stock-client";

export const dynamic = "force-dynamic";

export default async function AdminEstoquePage() {
  await requireAdminPage();

  const [items, suppliers, movements, projects] = await Promise.all([
    prisma.stockItem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { supplier: { select: { name: true } } },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        stockItem: { select: { name: true, unit: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.tattooProject.findMany({
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, name: true },
    }),
  ]);

  return (
    <StockClient
      items={items.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        unit: i.unit,
        currentQty: toNumber(i.currentQty),
        minQty: toNumber(i.minQty),
        unitCost: toNumber(i.unitCost),
        batchCode: i.batchCode,
        expiresAt: i.expiresAt ? i.expiresAt.toISOString().slice(0, 10) : null,
        supplierName: i.supplier?.name || null,
      }))}
      suppliers={suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        email: s.email,
      }))}
      movements={movements.map((m) => ({
        id: m.id,
        itemName: m.stockItem.name,
        unit: m.stockItem.unit,
        type: m.type,
        quantity: toNumber(m.quantity),
        cost: toNumber(m.quantity) * toNumber(m.unitCostSnapshot),
        projectName: m.project?.name || null,
        notes: m.notes,
        createdAt: m.createdAt.toISOString(),
      }))}
      projects={projects}
    />
  );
}
