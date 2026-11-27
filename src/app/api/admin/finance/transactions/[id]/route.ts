import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  assertFinancialContextAccess,
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";

const patchSchema = z.object({
  status: z.enum(["PAID", "RECEIVED", "PENDING", "OVERDUE", "CANCELLED"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi("studioFinance");
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    const existing = await prisma.financialTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Lançamento não encontrado." },
        { status: 404 }
      );
    }

    assertFinancialContextAccess(user, existing.context);

    const wasSettled =
      existing.status === "PAID" || existing.status === "RECEIVED";
    const nextStatus =
      existing.type === "INCOME" && parsed.data.status === "PAID"
        ? "RECEIVED"
        : existing.type === "EXPENSE" && parsed.data.status === "RECEIVED"
        ? "PAID"
        : parsed.data.status;
    const willBeSettled = nextStatus === "PAID" || nextStatus === "RECEIVED";

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.financialTransaction.update({
        where: { id },
        data: {
          status: nextStatus,
          paidAt: willBeSettled ? existing.paidAt ?? new Date() : null,
        },
      });

      if (existing.accountId && wasSettled !== willBeSettled) {
        const amt = toNumber(existing.amount);
        const sign = existing.type === "INCOME" ? 1 : -1;
        const delta = willBeSettled ? sign * amt : -sign * amt;
        await tx.financialAccount.update({
          where: { id: existing.accountId },
          data: { currentBalance: { increment: delta } },
        });
      }

      if (existing.paymentId) {
        await tx.payment.update({
          where: { id: existing.paymentId },
          data: {
            status: willBeSettled
              ? "CONFIRMED"
              : nextStatus === "CANCELLED"
                ? "FAILED"
                : "PENDING",
            confirmedAt: willBeSettled ? existing.paidAt ?? new Date() : null,
            confirmedByUserId: willBeSettled ? user.id : null,
          },
        });
      }

      return saved;
    });

    return NextResponse.json({ transaction: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao atualizar lançamento." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi("studioFinance");
    const { id } = await context.params;
    const existing = await prisma.financialTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Lançamento não encontrado." },
        { status: 404 }
      );
    }
    assertFinancialContextAccess(user, existing.context);

    const wasSettled =
      existing.status === "PAID" || existing.status === "RECEIVED";

    await prisma.$transaction(async (tx) => {
      if (existing.accountId && wasSettled) {
        const amt = toNumber(existing.amount);
        const reverseDelta = existing.type === "INCOME" ? -amt : amt;
        await tx.financialAccount.update({
          where: { id: existing.accountId },
          data: { currentBalance: { increment: reverseDelta } },
        });
      }
      await tx.financialTransaction.delete({ where: { id } });
      if (existing.paymentId) {
        await tx.payment.deleteMany({ where: { id: existing.paymentId } });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao excluir lançamento." },
      { status: 500 }
    );
  }
}
