import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { canAccessPersonalFinance } from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";
import { recordAuditLog } from "@/lib/security/audit";

const updateCommissionSchema = z.object({
  commissionPercent: z.number().min(0).max(100),
});

const createClosingSchema = z.object({
  periodDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  periodLabel: z.string().trim().max(80).optional(),
  grossRevenue: z.number().min(0),
  totalExpenses: z.number().min(0),
  netResult: z.number(),
  pixTotal: z.number().min(0).default(0),
  cardTotal: z.number().min(0).default(0),
  cashTotal: z.number().min(0).default(0),
  commissionPercent: z.number().min(0).max(100),
  countedCash: z.number().min(0).optional().nullable(),
  notes: z.string().trim().max(500).optional(),
  transferCommission: z
    .object({
      fromAccountId: z.string().min(1),
      toAccountId: z.string().min(1),
    })
    .optional()
    .nullable(),
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function GET() {
  try {
    await requireAdminApi("finance");
    const [settings, closings] = await Promise.all([
      prisma.studioSetting.findUnique({
        where: { id: "studio-default" },
        select: { commissionPercent: true },
      }),
      prisma.cashClosing.findMany({
        orderBy: [{ periodDate: "desc" }, { createdAt: "desc" }],
        take: 40,
        include: { closedBy: { select: { name: true } } },
      }),
    ]);

    return NextResponse.json({
      commissionPercent: settings ? toNumber(settings.commissionPercent) : 30,
      closings: closings.map((c) => ({
        id: c.id,
        periodDate: c.periodDate.toISOString().slice(0, 10),
        periodEndDate: c.periodEndDate
          ? c.periodEndDate.toISOString().slice(0, 10)
          : null,
        periodLabel: c.periodLabel,
        grossRevenue: toNumber(c.grossRevenue),
        totalExpenses: toNumber(c.totalExpenses),
        netResult: toNumber(c.netResult),
        pixTotal: toNumber(c.pixTotal),
        cardTotal: toNumber(c.cardTotal),
        cashTotal: toNumber(c.cashTotal),
        commissionPercent: toNumber(c.commissionPercent),
        commissionAmount: toNumber(c.commissionAmount),
        studioShareAmount: toNumber(c.studioShareAmount),
        countedCash: c.countedCash !== null ? toNumber(c.countedCash) : null,
        cashDifference:
          c.cashDifference !== null ? toNumber(c.cashDifference) : null,
        transferredToPersonal: c.transferredToPersonal,
        notes: c.notes,
        closedByName: c.closedBy.name,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao carregar fechamentos de caixa." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAdminApi("finance");
    const body = await request.json().catch(() => null);
    const parsed = updateCommissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Informe uma porcentagem entre 0% e 100%." },
        { status: 400 }
      );
    }

    const commissionPercent = round2(parsed.data.commissionPercent);
    await prisma.studioSetting.upsert({
      where: { id: "studio-default" },
      create: {
        id: "studio-default",
        commissionPercent,
      },
      update: {
        commissionPercent,
      },
    });

    await recordAuditLog({
      actorUserId: user.id,
      action: "COMMISSION_PERCENT_UPDATED",
      entityType: "StudioSetting",
      entityId: "studio-default",
      after: { commissionPercent },
    });

    return NextResponse.json({ commissionPercent });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao salvar porcentagem de comissão." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi("finance");
    const body = await request.json().catch(() => null);
    const parsed = createClosingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos para fechamento de caixa." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const pct = round2(d.commissionPercent);
    const commissionAmount = round2((d.grossRevenue * pct) / 100);
    const studioShareAmount = round2(d.grossRevenue - commissionAmount);
    const cashDifference =
      d.countedCash !== undefined && d.countedCash !== null
        ? round2(d.countedCash - d.cashTotal)
        : null;

    const shouldTransfer =
      Boolean(d.transferCommission) &&
      commissionAmount > 0 &&
      canAccessPersonalFinance(user);

    if (
      d.transferCommission &&
      d.transferCommission.fromAccountId === d.transferCommission.toAccountId
    ) {
      return NextResponse.json(
        { error: "A conta de origem e destino devem ser diferentes." },
        { status: 400 }
      );
    }

    const closing = await prisma.$transaction(async (tx) => {
      await tx.studioSetting.upsert({
        where: { id: "studio-default" },
        create: { id: "studio-default", commissionPercent: pct },
        update: { commissionPercent: pct },
      });

      let transferred = false;
      if (shouldTransfer && d.transferCommission) {
        const [fromAcc, toAcc] = await Promise.all([
          tx.financialAccount.findUnique({
            where: { id: d.transferCommission.fromAccountId },
          }),
          tx.financialAccount.findUnique({
            where: { id: d.transferCommission.toAccountId },
          }),
        ]);
        if (!fromAcc || !toAcc) {
          throw new Error("ACCOUNT_NOT_FOUND");
        }

        await tx.internalTransfer.create({
          data: {
            ownerUserId: user.id,
            fromAccountId: fromAcc.id,
            toAccountId: toAcc.id,
            amount: commissionAmount,
            transferDate: new Date(`${d.periodDate}T00:00:00.000Z`),
            description: `Comissão (${pct}%) — Fechamento ${
              d.periodLabel || d.periodDate
            }`,
            transferKind: "OWNER_WITHDRAWAL",
            notes: d.notes || null,
          },
        });

        await tx.financialAccount.update({
          where: { id: fromAcc.id },
          data: { currentBalance: { decrement: commissionAmount } },
        });
        await tx.financialAccount.update({
          where: { id: toAcc.id },
          data: { currentBalance: { increment: commissionAmount } },
        });
        transferred = true;
      }

      return tx.cashClosing.create({
        data: {
          closedByUserId: user.id,
          periodDate: new Date(`${d.periodDate}T00:00:00.000Z`),
          periodEndDate: d.periodEndDate
            ? new Date(`${d.periodEndDate}T00:00:00.000Z`)
            : null,
          periodLabel: d.periodLabel || null,
          grossRevenue: round2(d.grossRevenue),
          totalExpenses: round2(d.totalExpenses),
          netResult: round2(d.netResult),
          pixTotal: round2(d.pixTotal),
          cardTotal: round2(d.cardTotal),
          cashTotal: round2(d.cashTotal),
          commissionPercent: pct,
          commissionAmount,
          studioShareAmount,
          countedCash:
            d.countedCash !== undefined && d.countedCash !== null
              ? round2(d.countedCash)
              : null,
          cashDifference,
          transferredToPersonal: transferred,
          notes: d.notes || null,
        },
        include: { closedBy: { select: { name: true } } },
      });
    });

    await recordAuditLog({
      actorUserId: user.id,
      action: "CASH_CLOSING_CREATED",
      entityType: "CashClosing",
      entityId: closing.id,
      after: {
        periodDate: d.periodDate,
        grossRevenue: d.grossRevenue,
        commissionPercent: pct,
        commissionAmount,
        transferredToPersonal: closing.transferredToPersonal,
      },
    });

    return NextResponse.json(
      {
        closing: {
          id: closing.id,
          periodDate: closing.periodDate.toISOString().slice(0, 10),
          periodEndDate: closing.periodEndDate
            ? closing.periodEndDate.toISOString().slice(0, 10)
            : null,
          periodLabel: closing.periodLabel,
          grossRevenue: toNumber(closing.grossRevenue),
          totalExpenses: toNumber(closing.totalExpenses),
          netResult: toNumber(closing.netResult),
          pixTotal: toNumber(closing.pixTotal),
          cardTotal: toNumber(closing.cardTotal),
          cashTotal: toNumber(closing.cashTotal),
          commissionPercent: toNumber(closing.commissionPercent),
          commissionAmount: toNumber(closing.commissionAmount),
          studioShareAmount: toNumber(closing.studioShareAmount),
          countedCash:
            closing.countedCash !== null ? toNumber(closing.countedCash) : null,
          cashDifference:
            closing.cashDifference !== null
              ? toNumber(closing.cashDifference)
              : null,
          transferredToPersonal: closing.transferredToPersonal,
          notes: closing.notes,
          closedByName: closing.closedBy.name,
          createdAt: closing.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof Error && err.message === "ACCOUNT_NOT_FOUND") {
      return NextResponse.json(
        { error: "Conta para transferência não encontrada." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Erro ao registrar fechamento de caixa." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminApi("finance");
    const url = new URL(request.url);
    let id = url.searchParams.get("id")?.trim() || "";
    if (!id) {
      const body = await request.json().catch(() => ({}));
      if (typeof body?.id === "string") id = body.id.trim();
    }

    if (!id) {
      return NextResponse.json(
        { error: "Informe o fechamento que deseja excluir." },
        { status: 400 }
      );
    }

    await prisma.cashClosing.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao excluir fechamento de caixa." },
      { status: 500 }
    );
  }
}
