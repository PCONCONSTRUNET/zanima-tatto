import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";
import { dispatchNotification } from "@/lib/notifications";
import { recordAuditLog } from "@/lib/security/audit";

const registerPaymentSchema = z.object({
  clientId: z.string().min(1),
  appointmentId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  kind: z.enum(["DEPOSIT", "PARTIAL", "FULL"]),
  method: z.enum(["PIX", "CREDIT_CARD", "DEBIT_CARD", "CASH", "BANK_TRANSFER"]),
  amount: z.number().positive("O valor deve ser maior que zero."),
  status: z.enum(["PENDING", "CONFIRMED"]).default("CONFIRMED"),
  idempotencyKey: z.string().optional(),
  notes: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi("studioFinance");
    const body = await request.json().catch(() => null);
    const parsed = registerPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const idempotencyKey = d.idempotencyKey || crypto.randomUUID();

    // Prevenção de duplicidade por chave de idempotência
    const duplicate = await prisma.payment.findUnique({
      where: { idempotencyKey },
    });
    if (duplicate) {
      return NextResponse.json({ payment: duplicate, deduplicated: true });
    }

    const client = await prisma.client.findUnique({
      where: { id: d.clientId },
      select: { id: true, fullName: true, userId: true },
    });
    if (!client) {
      return NextResponse.json(
        { error: "Cliente não encontrado." },
        { status: 404 }
      );
    }

    const ownerUser = await prisma.user.findFirst({
      where: { role: "OWNER", active: true },
      select: { id: true },
    });
    const financeOwnerId = ownerUser?.id ?? user.id;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          clientId: d.clientId,
          appointmentId: d.appointmentId || null,
          projectId: d.projectId || null,
          kind: d.kind,
          method: d.method,
          gatewayProvider: "MANUAL",
          idempotencyKey,
          amount: d.amount,
          status: d.status,
          confirmedAt: d.status === "CONFIRMED" ? new Date() : null,
          confirmedByUserId: d.status === "CONFIRMED" ? user.id : null,
          notes: d.notes || null,
        },
      });

      const category = await tx.financialCategory.findFirst({
        where: {
          ownerUserId: financeOwnerId,
          context: "STUDIO",
          kind: "INCOME",
        },
      });

      const targetAccountId =
        d.accountId ||
        (
          await tx.financialAccount.findFirst({
            where: {
              ownerUserId: financeOwnerId,
              context: "STUDIO",
              isActive: true,
            },
          })
        )?.id ||
        null;

      if (category) {
        const isConfirmed = d.status === "CONFIRMED";
        await tx.financialTransaction.create({
          data: {
            ownerUserId: financeOwnerId,
            context: "STUDIO",
            type: "INCOME",
            description: `${
              d.kind === "DEPOSIT"
                ? "Sinal"
                : d.kind === "PARTIAL"
                ? "Pagamento parcial"
                : "Quitação"
            } — ${client.fullName}`,
            amount: d.amount,
            competenceDate: new Date(),
            dueDate: new Date(),
            paidAt: isConfirmed ? new Date() : null,
            status: isConfirmed ? "RECEIVED" : "PENDING",
            categoryId: category.id,
            accountId: targetAccountId,
            paymentMethod: d.method,
            appointmentId: d.appointmentId || null,
            projectId: d.projectId || null,
            paymentId: payment.id,
          },
        });

        if (isConfirmed && targetAccountId) {
          await tx.financialAccount.update({
            where: { id: targetAccountId },
            data: { currentBalance: { increment: toNumber(d.amount) } },
          });
        }
      }

      if (d.status === "CONFIRMED" && d.appointmentId && d.kind === "DEPOSIT") {
        await tx.appointment.updateMany({
          where: { id: d.appointmentId, status: "AWAITING_DEPOSIT" },
          data: { status: "CONFIRMED", confirmedAt: new Date() },
        });
      }

      return payment;
    });

    if (client.userId && d.status === "CONFIRMED") {
      await dispatchNotification({
        recipientUserId: client.userId,
        eventType: "PAYMENT_CONFIRMED",
        title: "Pagamento confirmado",
        body: `Recebemos a confirmação do seu pagamento de R$ ${d.amount.toFixed(2).replace(".", ",")}.`,
        linkUrl: "/minha-conta/financeiro",
        channels: ["IN_APP"],
      });
    }

    await recordAuditLog({
      actorUserId: user.id,
      action: "PAYMENT_REGISTERED",
      entityType: "Payment",
      entityId: result.id,
      after: { amount: d.amount, method: d.method, status: d.status },
    });

    return NextResponse.json({ payment: result }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao registrar pagamento." },
      { status: 500 }
    );
  }
}
