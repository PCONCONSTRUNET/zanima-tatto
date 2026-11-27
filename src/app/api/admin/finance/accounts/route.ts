import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  assertFinancialContextAccess,
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";

const accountSchema = z.object({
  entity: z.literal("account"),
  context: z.enum(["STUDIO", "PERSONAL"]),
  name: z.string().trim().min(2),
  type: z.enum(["BANK", "CASH", "DIGITAL_WALLET", "RESERVE"]),
  institution: z.string().trim().optional(),
  initialBalance: z.number().default(0),
});

const cardSchema = z.object({
  entity: z.literal("card"),
  context: z.enum(["STUDIO", "PERSONAL"]),
  name: z.string().trim().min(2),
  brand: z.string().trim().min(2),
  last4: z.string().trim().length(4, "Informe os 4 últimos dígitos."),
  creditLimit: z.number().positive(),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  linkedAccountId: z.string().optional().nullable(),
});

const categorySchema = z.object({
  entity: z.literal("category"),
  context: z.enum(["STUDIO", "PERSONAL"]),
  name: z.string().trim().min(2),
  kind: z.enum(["INCOME", "EXPENSE"]),
  parentId: z.string().optional().nullable(),
  monthlyLimit: z.number().positive().optional().nullable(),
});

const goalSchema = z.object({
  entity: z.literal("goal"),
  context: z.enum(["STUDIO", "PERSONAL"]),
  name: z.string().trim().min(2),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).default(0),
  targetDate: z.string().optional(),
  linkedAccountId: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi("studioFinance");
    const body = await request.json().catch(() => null);

    if (body?.entity === "account") {
      const parsed = accountSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Dados inválidos." },
          { status: 400 }
        );
      }
      assertFinancialContextAccess(user, parsed.data.context);
      const account = await prisma.financialAccount.create({
        data: {
          ownerUserId: user.id,
          context: parsed.data.context,
          name: parsed.data.name,
          type: parsed.data.type,
          institution: parsed.data.institution || null,
          initialBalance: parsed.data.initialBalance,
          currentBalance: parsed.data.initialBalance,
        },
      });
      return NextResponse.json({ account }, { status: 201 });
    }

    if (body?.entity === "card") {
      const parsed = cardSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Dados inválidos." },
          { status: 400 }
        );
      }
      assertFinancialContextAccess(user, parsed.data.context);
      const card = await prisma.creditCard.create({
        data: {
          ownerUserId: user.id,
          context: parsed.data.context,
          name: parsed.data.name,
          brand: parsed.data.brand,
          last4: parsed.data.last4,
          creditLimit: parsed.data.creditLimit,
          closingDay: parsed.data.closingDay,
          dueDay: parsed.data.dueDay,
          linkedAccountId: parsed.data.linkedAccountId || null,
        },
      });
      return NextResponse.json({ card }, { status: 201 });
    }

    if (body?.entity === "category") {
      const parsed = categorySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Dados inválidos." },
          { status: 400 }
        );
      }
      assertFinancialContextAccess(user, parsed.data.context);
      const category = await prisma.financialCategory.create({
        data: {
          ownerUserId: user.id,
          context: parsed.data.context,
          name: parsed.data.name,
          kind: parsed.data.kind,
          parentId: parsed.data.parentId || null,
          monthlyLimit: parsed.data.monthlyLimit ?? null,
        },
      });
      return NextResponse.json({ category }, { status: 201 });
    }

    if (body?.entity === "goal") {
      const parsed = goalSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Dados inválidos." },
          { status: 400 }
        );
      }
      assertFinancialContextAccess(user, parsed.data.context);
      const goal = await prisma.financialGoal.create({
        data: {
          ownerUserId: user.id,
          context: parsed.data.context,
          name: parsed.data.name,
          targetAmount: parsed.data.targetAmount,
          currentAmount: parsed.data.currentAmount,
          targetDate: parsed.data.targetDate
            ? new Date(`${parsed.data.targetDate.slice(0, 10)}T00:00:00.000Z`)
            : null,
          linkedAccountId: parsed.data.linkedAccountId || null,
        },
      });
      return NextResponse.json({ goal }, { status: 201 });
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
      { error: "Erro ao salvar configuração financeira." },
      { status: 500 }
    );
  }
}
