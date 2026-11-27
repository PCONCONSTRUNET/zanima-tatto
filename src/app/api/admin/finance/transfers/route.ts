import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireOwnerApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { recordAuditLog } from "@/lib/security/audit";

const transferSchema = z.object({
  fromAccountId: z.string().min(1, "Selecione a conta de origem."),
  toAccountId: z.string().min(1, "Selecione a conta de destino."),
  amount: z.number().positive("O valor deve ser maior que zero."),
  transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(2, "Informe a descrição da transferência."),
  transferKind: z.enum([
    "OWNER_WITHDRAWAL",
    "RESERVE_DEPOSIT",
    "ACCOUNT_TRANSFER",
  ]),
  notes: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    // Transferências entre estúdio e pessoal são exclusivas da proprietária
    const user = await requireOwnerApi();
    const body = await request.json().catch(() => null);
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    if (d.fromAccountId === d.toAccountId) {
      return NextResponse.json(
        { error: "A conta de origem e destino devem ser diferentes." },
        { status: 400 }
      );
    }

    const [fromAcc, toAcc] = await Promise.all([
      prisma.financialAccount.findUnique({ where: { id: d.fromAccountId } }),
      prisma.financialAccount.findUnique({ where: { id: d.toAccountId } }),
    ]);

    if (!fromAcc || !toAcc) {
      return NextResponse.json(
        { error: "Conta de origem ou destino não encontrada." },
        { status: 404 }
      );
    }

    // Transferência interna apenas movimenta saldos entre carteiras — NUNCA cria receita/despesa duplicada
    const transfer = await prisma.$transaction(async (tx) => {
      const created = await tx.internalTransfer.create({
        data: {
          ownerUserId: user.id,
          fromAccountId: d.fromAccountId,
          toAccountId: d.toAccountId,
          amount: d.amount,
          transferDate: new Date(`${d.transferDate}T00:00:00.000Z`),
          description: d.description,
          transferKind: d.transferKind,
          notes: d.notes || null,
        },
      });

      await tx.financialAccount.update({
        where: { id: d.fromAccountId },
        data: { currentBalance: { decrement: d.amount } },
      });

      await tx.financialAccount.update({
        where: { id: d.toAccountId },
        data: { currentBalance: { increment: d.amount } },
      });

      return created;
    });

    await recordAuditLog({
      actorUserId: user.id,
      action: "TRANSFER_CREATED",
      entityType: "InternalTransfer",
      entityId: transfer.id,
      after: {
        from: fromAcc.name,
        to: toAcc.name,
        amount: d.amount,
        kind: d.transferKind,
      },
    });

    return NextResponse.json({ transfer }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao registrar transferência interna." },
      { status: 500 }
    );
  }
}
