import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessPersonalFinance, requireAdminPage } from "@/lib/security/rbac";
import { toISODateSP, toNumber } from "@/lib/format";
import { FinanceClient } from "@/components/admin/finance-client";

export const dynamic = "force-dynamic";

export default async function AdminPessoalPage() {
  const user = await requireAdminPage();
  const isOwner = canAccessPersonalFinance(user);
  if (!isOwner) {
    redirect("/admin");
  }

  const todayStr = toISODateSP();
  const currentMonth = todayStr.slice(0, 7);

  const [
    personalAccounts,
    allUserAccounts,
    cards,
    categories,
    transactions,
    transfers,
    goals,
  ] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { ownerUserId: user.id, context: "PERSONAL", isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.financialAccount.findMany({
      where: { ownerUserId: user.id, isActive: true },
      orderBy: [{ context: "asc" }, { name: "asc" }],
    }),
    prisma.creditCard.findMany({
      where: { ownerUserId: user.id, context: "PERSONAL", isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.financialCategory.findMany({
      where: { ownerUserId: user.id, context: "PERSONAL" },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    prisma.financialTransaction.findMany({
      where: { ownerUserId: user.id, context: "PERSONAL" },
      orderBy: [{ competenceDate: "desc" }, { createdAt: "desc" }],
      take: 400,
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        creditCard: { select: { id: true, name: true, last4: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.internalTransfer.findMany({
      where: { ownerUserId: user.id },
      orderBy: { transferDate: "desc" },
      take: 100,
      include: {
        fromAccount: { select: { id: true, name: true, context: true } },
        toAccount: { select: { id: true, name: true, context: true } },
      },
    }),
    prisma.financialGoal.findMany({
      where: { ownerUserId: user.id, context: "PERSONAL" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <FinanceClient
      fixedContext="PERSONAL"
      isOwner={isOwner}
      hideValues={user.hideFinancialValues}
      todayStr={todayStr}
      currentMonth={currentMonth}
      initialAccounts={personalAccounts.map((a) => ({
        id: a.id,
        context: a.context,
        name: a.name,
        type: a.type,
        institution: a.institution,
        currentBalance: toNumber(a.currentBalance),
      }))}
      transferAccounts={allUserAccounts.map((a) => ({
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
      projects={[]}
    />
  );
}
