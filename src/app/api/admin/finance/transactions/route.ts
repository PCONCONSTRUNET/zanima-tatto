import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  assertFinancialContextAccess,
  canAccessPersonalFinance,
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { recordAuditLog } from "@/lib/security/audit";
import { dispatchNotification } from "@/lib/notifications";

const createTxSchema = z.object({
  context: z.enum(["STUDIO", "PERSONAL"]),
  type: z.enum(["INCOME", "EXPENSE"]),
  description: z.string().trim().min(2, "Informe a descrição do lançamento."),
  amount: z.number().positive("O valor deve ser maior que zero."),
  competenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  status: z.enum(["PAID", "RECEIVED", "PENDING", "OVERDUE", "CANCELLED"]),
  categoryId: z.string().min(1, "Selecione uma categoria."),
  accountId: z.string().optional().nullable(),
  creditCardId: z.string().optional().nullable(),
  paymentMethod: z.enum([
    "PIX",
    "CREDIT_CARD",
    "DEBIT_CARD",
    "CASH",
    "BANK_TRANSFER",
  ]),
  totalInstallments: z.number().int().min(1).max(36).default(1),
  recurringMonths: z.number().int().min(1).max(24).default(1),
  projectId: z.string().optional().nullable(),
  appointmentId: z.string().optional().nullable(),
  attachmentFileId: z.string().optional().nullable(),
  notes: z.string().trim().optional(),
});

function addMonthsISODate(dateStr: string, monthsToAdd: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + monthsToAdd, Math.min(d, 28)));
  return dt;
}

export async function GET(request: Request) {
  try {
    const user = await requireAdminApi("studioFinance");
    const { searchParams } = new URL(request.url);
    const scopeParam = (searchParams.get("context") || "STUDIO") as
      | "ALL"
      | "STUDIO"
      | "PERSONAL";

    assertFinancialContextAccess(user, scopeParam);

    const where: Record<string, unknown> = {};
    if (scopeParam === "STUDIO" || scopeParam === "PERSONAL") {
      where.context = scopeParam;
    } else if (!canAccessPersonalFinance(user)) {
      where.context = "STUDIO";
    }

    if (scopeParam === "PERSONAL" || scopeParam === "ALL") {
      where.ownerUserId = user.id;
    }

    const transactions = await prisma.financialTransaction.findMany({
      where,
      orderBy: [{ competenceDate: "desc" }, { createdAt: "desc" }],
      take: 250,
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        creditCard: { select: { id: true, name: true, last4: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ transactions });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao consultar lançamentos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi("studioFinance");
    const body = await request.json().catch(() => null);
    const parsed = createTxSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    assertFinancialContextAccess(user, d.context);

    // Garante coerência entre tipo e status liquidado
    const normalizedStatus =
      d.type === "INCOME" && d.status === "PAID"
        ? "RECEIVED"
        : d.type === "EXPENSE" && d.status === "RECEIVED"
        ? "PAID"
        : d.status;

    const count = Math.max(d.totalInstallments, d.recurringMonths);
    const isInstallment = d.totalInstallments > 1;
    const isRecurring = !isInstallment && d.recurringMonths > 1;
    const groupId = count > 1 ? crypto.randomUUID() : null;
    const perEntryAmount = isInstallment
      ? Number((d.amount / d.totalInstallments).toFixed(2))
      : d.amount;

    // Resolve cliente vinculado ao projeto ou agendamento para sincronizar Pagamentos do Cliente
    let linkedClient: { id: string; userId: string | null } | null = null;
    if (d.type === "INCOME" && d.context === "STUDIO") {
      if (d.projectId) {
        const proj = await prisma.tattooProject.findUnique({
          where: { id: d.projectId },
          select: { client: { select: { id: true, userId: true } } },
        });
        linkedClient = proj?.client ?? null;
      } else if (d.appointmentId) {
        const appt = await prisma.appointment.findUnique({
          where: { id: d.appointmentId },
          select: { client: { select: { id: true, userId: true } } },
        });
        linkedClient = appt?.client ?? null;
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const list = [];
      for (let i = 0; i < count; i++) {
        const compDate = addMonthsISODate(d.competenceDate, i);
        const dueDate = d.dueDate
          ? addMonthsISODate(d.dueDate, i)
          : compDate;
        const entryStatus =
          i === 0
            ? normalizedStatus
            : "PENDING";
        const isSettled = entryStatus === "PAID" || entryStatus === "RECEIVED";

        let syncedPaymentId: string | null = null;
        if (linkedClient) {
          const paymentStatus = isSettled
            ? "CONFIRMED"
            : entryStatus === "CANCELLED"
              ? "FAILED"
              : "PENDING";
          const lowerDesc = d.description.toLowerCase();
          const paymentKind = lowerDesc.includes("sinal")
            ? "DEPOSIT"
            : isInstallment || count > 1
              ? "PARTIAL"
              : "FULL";
          const syncedPayment = await tx.payment.create({
            data: {
              clientId: linkedClient.id,
              appointmentId: d.appointmentId || null,
              projectId: d.projectId || null,
              kind: paymentKind,
              method: d.paymentMethod,
              gatewayProvider: "MANUAL",
              idempotencyKey: crypto.randomUUID(),
              amount: perEntryAmount,
              status: paymentStatus,
              confirmedAt: isSettled ? new Date() : null,
              confirmedByUserId: isSettled ? user.id : null,
              receiptFileId: d.attachmentFileId || null,
              notes: isInstallment
                ? `${d.description} (${i + 1}/${count})`
                : d.description,
            },
          });
          syncedPaymentId = syncedPayment.id;
        }

        const item = await tx.financialTransaction.create({
          data: {
            ownerUserId: user.id,
            context: d.context,
            type: d.type,
            description: isInstallment
              ? `${d.description} (${i + 1}/${count})`
              : d.description,
            amount: perEntryAmount,
            competenceDate: compDate,
            dueDate,
            paidAt: isSettled ? new Date() : null,
            status: entryStatus,
            categoryId: d.categoryId,
            accountId: d.accountId || null,
            creditCardId: d.creditCardId || null,
            paymentMethod: d.paymentMethod,
            installmentGroupId: isInstallment ? groupId : null,
            installmentNumber: isInstallment ? i + 1 : null,
            totalInstallments: isInstallment ? count : null,
            recurrenceRule: isRecurring ? "MONTHLY" : null,
            projectId: d.projectId || null,
            appointmentId: d.appointmentId || null,
            paymentId: syncedPaymentId,
            attachmentFileId: d.attachmentFileId || null,
            notes: d.notes || null,
          },
        });

        if (isSettled && d.accountId) {
          const delta = d.type === "INCOME" ? perEntryAmount : -perEntryAmount;
          await tx.financialAccount.update({
            where: { id: d.accountId },
            data: { currentBalance: { increment: delta } },
          });
        }

        list.push(item);
      }
      return list;
    });

    if (linkedClient?.userId && created[0]) {
      const settledFirst =
        created[0].status === "RECEIVED" || created[0].status === "PAID";
      await dispatchNotification({
        recipientUserId: linkedClient.userId,
        eventType: settledFirst ? "PAYMENT_CONFIRMED" : "PAYMENT_PENDING",
        title: settledFirst ? "Pagamento confirmado" : "Novo pagamento registrado",
        body: `${d.description} — R$ ${d.amount.toFixed(2).replace(".", ",")}.`,
        linkUrl: "/minha-conta/financeiro",
        channels: ["IN_APP"],
      });
    }

    await recordAuditLog({
      actorUserId: user.id,
      action: "TRANSACTION_CREATED",
      entityType: "FinancialTransaction",
      entityId: created[0].id,
      after: {
        context: d.context,
        type: d.type,
        amount: d.amount,
        entries: created.length,
      },
    });

    return NextResponse.json(
      { transaction: created[0], count: created.length },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[POST /api/admin/finance/transactions]", err);
    return NextResponse.json(
      { error: "Erro ao registrar lançamento financeiro." },
      { status: 500 }
    );
  }
}
