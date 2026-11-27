import { prisma } from "@/lib/prisma";
import { canAccessPersonalFinance, requireAdminPage } from "@/lib/security/rbac";
import {
  computeAppointmentPaidAmount,
  toISODateSP,
  toNumber,
} from "@/lib/format";
import { autoCompleteElapsedAppointments } from "@/lib/agenda/scheduling";
import { FinanceClient } from "@/components/admin/finance-client";

export const dynamic = "force-dynamic";

export default async function AdminFinanceiroPage() {
  const user = await requireAdminPage();
  await autoCompleteElapsedAppointments();
  const isOwner = canAccessPersonalFinance(user);
  const todayStr = toISODateSP();
  const currentMonth = todayStr.slice(0, 7);
  const currentMonthStart = new Date(`${currentMonth}-01T00:00:00.000Z`);

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
    studioSetting,
    cashClosings,
    prevStudioGrossAgg,
    studioToPersonalAgg,
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
      take: 250,
      include: {
        client: { select: { id: true, fullName: true } },
        service: { select: { name: true } },
        payments: { select: { amount: true, status: true } },
        financialTransactions: {
          where: { type: "INCOME", status: { not: "CANCELLED" } },
          select: { amount: true, status: true, paymentId: true },
        },
      },
    }),
    prisma.studioSetting.findUnique({
      where: { id: "studio-default" },
      select: { commissionPercent: true },
    }),
    prisma.cashClosing.findMany({
      orderBy: [{ periodDate: "desc" }, { createdAt: "desc" }],
      take: 40,
      include: { closedBy: { select: { name: true } } },
    }),
    prisma.financialTransaction.aggregate({
      where: {
        context: "STUDIO",
        type: "INCOME",
        status: "RECEIVED",
        competenceDate: { lt: currentMonthStart },
      },
      _sum: { amount: true },
    }),
    prisma.internalTransfer.aggregate({
      where: {
        fromAccount: { context: "STUDIO" },
        toAccount: { context: "PERSONAL" },
      },
      _sum: { amount: true },
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
        createdAt: t.createdAt.toISOString(),
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
        createdAt: tr.createdAt.toISOString(),
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
      initialCommissionPercent={
        studioSetting ? toNumber(studioSetting.commissionPercent) : 30
      }
      prevMonthsStudioGross={toNumber(prevStudioGrossAgg._sum.amount)}
      allStudioToPersonalTransferred={toNumber(
        studioToPersonalAgg._sum.amount
      )}
      initialClosings={cashClosings.map((c) => ({
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
      }))}
      studioAppointments={appointments.map((a) => {
        const receivedAmount = computeAppointmentPaidAmount(
          a.payments,
          a.financialTransactions
        );
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
