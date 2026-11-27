import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";
import { notifyStudioAdmins } from "@/lib/notifications";

const supplierSchema = z.object({
  entity: z.literal("supplier"),
  name: z.string().trim().min(2),
  contactName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
});

const itemSchema = z.object({
  entity: z.literal("item"),
  supplierId: z.string().optional().nullable(),
  name: z.string().trim().min(2),
  category: z.string().trim().min(2),
  unit: z.string().trim().min(1),
  currentQty: z.number().min(0).default(0),
  minQty: z.number().min(0).default(0),
  unitCost: z.number().min(0).default(0),
  batchCode: z.string().trim().optional(),
  expiresAt: z.string().optional().or(z.literal("")),
});

const movementSchema = z.object({
  entity: z.literal("movement"),
  stockItemId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.number().positive(),
  projectId: z.string().optional().nullable(),
  appointmentId: z.string().optional().nullable(),
  notes: z.string().trim().optional(),
});

export async function GET() {
  try {
    await requireAdminApi("stock");
    const [items, suppliers, movements] = await Promise.all([
      prisma.stockItem.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        include: { supplier: { select: { id: true, name: true } } },
      }),
      prisma.supplier.findMany({ orderBy: { name: "asc" } }),
      prisma.stockMovement.findMany({
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          stockItem: { select: { name: true, unit: true } },
          project: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({ items, suppliers, movements });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao carregar estoque." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi("stock");
    const body = await request.json().catch(() => null);

    if (body?.entity === "supplier") {
      const parsed = supplierSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
      }
      const supplier = await prisma.supplier.create({
        data: {
          name: parsed.data.name,
          contactName: parsed.data.contactName || null,
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
        },
      });
      return NextResponse.json({ supplier }, { status: 201 });
    }

    if (body?.entity === "item") {
      const parsed = itemSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Dados do item inválidos." }, { status: 400 });
      }
      const d = parsed.data;
      const item = await prisma.stockItem.create({
        data: {
          supplierId: d.supplierId || null,
          name: d.name,
          category: d.category,
          unit: d.unit,
          currentQty: d.currentQty,
          minQty: d.minQty,
          unitCost: d.unitCost,
          batchCode: d.batchCode || null,
          expiresAt: d.expiresAt
            ? new Date(`${d.expiresAt.slice(0, 10)}T00:00:00.000Z`)
            : null,
        },
      });
      return NextResponse.json({ item }, { status: 201 });
    }

    if (body?.entity === "movement") {
      const parsed = movementSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Movimentação inválida." }, { status: 400 });
      }
      const d = parsed.data;

      const updatedItem = await prisma.$transaction(async (tx) => {
        const item = await tx.stockItem.findUnique({
          where: { id: d.stockItemId },
        });
        if (!item) throw new Error("ITEM_NOT_FOUND");

        const curr = toNumber(item.currentQty);
        const nextQty =
          d.type === "IN"
            ? curr + d.quantity
            : d.type === "OUT"
            ? Math.max(0, curr - d.quantity)
            : d.quantity;

        if (d.type === "OUT" && curr < d.quantity) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        await tx.stockMovement.create({
          data: {
            stockItemId: item.id,
            type: d.type,
            quantity: d.quantity,
            unitCostSnapshot: item.unitCost,
            projectId: d.projectId || null,
            appointmentId: d.appointmentId || null,
            recordedByUserId: user.id,
            notes: d.notes || null,
          },
        });

        return tx.stockItem.update({
          where: { id: item.id },
          data: { currentQty: nextQty },
        });
      });

      if (toNumber(updatedItem.currentQty) <= toNumber(updatedItem.minQty)) {
        await notifyStudioAdmins({
          eventType: "LOW_STOCK",
          title: "Alerta de reposição de estoque",
          body: `${updatedItem.name} atingiu ${toNumber(updatedItem.currentQty)} ${updatedItem.unit} (mínimo: ${toNumber(updatedItem.minQty)}).`,
          linkUrl: "/admin/estoque",
        });
      }

      return NextResponse.json({ item: updatedItem }, { status: 201 });
    }

    return NextResponse.json({ error: "Operação inválida." }, { status: 400 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof Error && err.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        { error: "Quantidade insuficiente em estoque." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erro ao atualizar estoque." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminApi("stock");

    const url = new URL(request.url);
    let id = url.searchParams.get("id")?.trim() || "";
    let entity = url.searchParams.get("entity")?.trim() || "item";
    const body = await request.json().catch(() => ({}));
    if (!id && typeof body?.id === "string") {
      id = body.id.trim();
    }
    if (typeof body?.entity === "string" && body.entity.trim()) {
      entity = body.entity.trim();
    }

    if (!id) {
      return NextResponse.json(
        { error: "Informe o registro que deseja excluir." },
        { status: 400 }
      );
    }

    if (entity === "supplier") {
      const existingSupplier = await prisma.supplier.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existingSupplier) {
        return NextResponse.json(
          { error: "Fornecedor não encontrado." },
          { status: 404 }
        );
      }

      await prisma.supplier.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    const existing = await prisma.stockItem.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Material não encontrado." },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.stockMovement.deleteMany({ where: { stockItemId: id } }),
      prisma.stockItem.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao excluir material de estoque." },
      { status: 500 }
    );
  }
}
