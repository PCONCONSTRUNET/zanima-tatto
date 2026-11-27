import { prisma } from "@/lib/prisma";
import { canAccessPersonalFinance, requireAdminPage } from "@/lib/security/rbac";
import { toISODateSP, toNumber } from "@/lib/format";
import { autoCompleteElapsedAppointments } from "@/lib/agenda/scheduling";
import { FinanceClient } from "@/components/admin/finance-client";

export const dynamic = "force-dynamic";

export default async function AdminFinanceiroPage() {
  const user = await requireAdminPage();
  await autoCompleteElapsedAppointments();
  const isOwner = canAccessPersonalFinance(user);
  const todayStr = toISODateSP();
  const currentMonth = todayStr.slice(0, 7);

  const [
    studioAccounts,
    allUserAccounts,
    cards,
    categories,
    transactions,
    transfers,
    goals,
    projects,
    appointments,
  ] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { context: "STUDIO", isActive: true },
      orderBy: { name: "asc" },
    }),
    isOwner
      ? prisma.financialAccount.findMany({
          where: { ownerUserId: user.id, isActive: true },
          orderBy: [{ context: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    prisma.creditCard.findMany({
      where: { context: "STUDIO", isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.financialCategory.findMany({
      where: { context: "STUDIO" },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    prisma.financialTransaction.findMany({
      where: { context: "STUDIO" },
      orderBy: [{ competenceDate: "desc" }, { createdAt: "desc" }],
      take: 400,
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        creditCard: { select: { id: true, name: true, last4: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    isOwner
      ? prisma.internalTransfer.findMany({
          where: { ownerUserId: user.id },
          orderBy: { transferDate: "desc" },
          take: 100,
          include: {
            fromAccount: { select: { id: true, name: true, context: true } },
            toAccount: { select: { id: true, name: true, context: true } },
          },
        })
      : Promise.resolve([]),
    prisma.financialGoal.findMany({
      where: { context: "STUDIO" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tattooProject.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, name: true },
    }),
    prisma.appointment.findMany({
      where: { status: { not: "CANCELLED" } },
      orderBy: { startAt: "desc" },
      take: 100,
      include: {
        client: { select: { id: true, fullName: true } },
        service: { select: { name: true } },
        payments: { select: { amount: true, status: true } },
        financialTransactions: {
          where: { type: "INCOME", status: { not: "CANCELLED" } },
          select: { amount: true, status: true },
        },
      },
    }),
  ]);

  const transferAccountsSource = isOwner ? allUserAccounts : studioAccounts;

  return (
    <FinanceClient
      fixedContext="STUDIO"
      isOwner={isOwner}
      hideValues={user.hideFinancialValues}
      todayStr={todayStr}
      currentMonth={currentMonth}
      initialAccounts={studioAccounts.map((a) => ({
        id: a.id,
        context: a.context,
        name: a.name,
        type: a.type,
        institution: a.institution,
        currentBalance: toNumber(a.currentBalance),
      }))}
      transferAccounts={transferAccountsSource.map((a) => ({
        id: a.id,
        context: a.context,
        name: a.name,
      }))}
      initialCards={cards.map((c) => ({
        id: c.id,
        context: c.context,
        name: c.name,
        brand: c.brand,
        last4: c.last4,
        creditLimit: toNumber(c.creditLimit),
        closingDay: c.closingDay,
        dueDay: c.dueDay,
      }))}
      initialCategories={categories.map((cat) => ({
        id: cat.id,
        context: cat.context,
        parentId: cat.parentId,
        name: cat.name,
        kind: cat.kind,
        monthlyLimit: cat.monthlyLimit ? toNumber(cat.monthlyLimit) : null,
      }))}
      initialTransactions={transactions.map((t) => ({
        id: t.id,
        context: t.context,
        type: t.type,
        description: t.description,
        amount: toNumber(t.amount),
        competenceDate: t.competenceDate.toISOString().slice(0, 10),
        dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
        status: t.status,
        categoryId: t.categoryId,
        categoryName: t.category.name,
        accountId: t.accountId,
        accountName: t.account?.name || null,
        creditCardId: t.creditCardId,
        creditCardName: t.creditCard
          ? `${t.creditCard.name} •••• ${t.creditCard.last4}`
          : null,
        paymentMethod: t.paymentMethod,
        projectId: t.projectId,
        projectName: t.project?.name || null,
        attachmentFileId: t.attachmentFileId,
        notes: t.notes,
      }))}
      initialTransfers={transfers.map((tr) => ({
        id: tr.id,
        fromAccountName: tr.fromAccount.name,
        fromContext: tr.fromAccount.context,
        toAccountName: tr.toAccount.name,
        toContext: tr.toAccount.context,
        amount: toNumber(tr.amount),
        transferDate: tr.transferDate.toISOString().slice(0, 10),
        description: tr.description,
        transferKind: tr.transferKind,
      }))}
      initialGoals={goals.map((g) => ({
        id: g.id,
        context: g.context,
        name: g.name,
        targetAmount: toNumber(g.targetAmount),
        currentAmount: toNumber(g.currentAmount),
        targetDate: g.targetDate ? g.targetDate.toISOString().slice(0, 10) : null,
      }))}
      projects={projects}
      studioAppointments={appointments.map((a) => {
        const txReceived = a.financialTransactions
          .filter((tx) => tx.status === "RECEIVED" || tx.status === "PAID")
          .reduce((acc, tx) => acc + toNumber(tx.amount), 0);
        const payConfirmed = a.payments
          .filter((p) => p.status === "CONFIRMED")
          .reduce((acc, p) => acc + toNumber(p.amount), 0);
        const receivedAmount = Math.max(txReceived, payConfirmed);
        return {
          id: a.id,
          clientId: a.client.id,
          clientName: a.client.fullName,
          title: a.service?.name || a.title,
          startAt: a.startAt.toISOString(),
          status: a.status,
          preferredPaymentMethod: a.preferredPaymentMethod || "PIX",
          priceEstimate: a.priceEstimate ? toNumber(a.priceEstimate) : 0,
          depositRequired: a.depositRequired ? toNumber(a.depositRequired) : 0,
          receivedAmount,
        };
      })}
    />
  );
}
