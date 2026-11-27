"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  CreditCard as CardIcon,
  Download,
  FileSpreadsheet,
  Lock,
  Paperclip,
  Percent,
  PieChart,
  Plus,
  SlidersHorizontal,
  Tag,
  Target,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { formatBRL, formatDateBR, formatTimeBR } from "@/lib/format";
import {
  ACCOUNT_TYPE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  PAYMENT_METHOD_LABELS,
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_STATUS_TONE,
  TRANSFER_KIND_LABELS,
} from "@/lib/domain-labels";
import {
  Button,
  ConfirmModal,
  CurrencyInput,
  EmptyState,
  Field,
  Input,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";
import { IosDatePicker } from "@/components/ui/ios-date-picker";

type AccountItem = {
  id: string;
  context: "STUDIO" | "PERSONAL";
  name: string;
  type: string;
  institution: string | null;
  currentBalance: number;
};

type TransferAccountItem = {
  id: string;
  context: "STUDIO" | "PERSONAL";
  name: string;
};

type CardItem = {
  id: string;
  context: "STUDIO" | "PERSONAL";
  name: string;
  brand: string;
  last4: string;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
};

type CategoryItem = {
  id: string;
  context: "STUDIO" | "PERSONAL";
  parentId: string | null;
  name: string;
  kind: "INCOME" | "EXPENSE";
  monthlyLimit: number | null;
};

type TxItem = {
  id: string;
  context: "STUDIO" | "PERSONAL";
  type: "INCOME" | "EXPENSE";
  description: string;
  amount: number;
  competenceDate: string;
  dueDate: string | null;
  createdAt: string;
  status: string;
  categoryId: string;
  categoryName: string;
  accountId: string | null;
  accountName: string | null;
  creditCardId: string | null;
  creditCardName: string | null;
  paymentMethod: string;
  projectId: string | null;
  projectName: string | null;
  attachmentFileId: string | null;
  notes: string | null;
};

type TransferItem = {
  id: string;
  fromAccountName: string;
  fromContext: string;
  toAccountName: string;
  toContext: string;
  amount: number;
  transferDate: string;
  description: string;
  transferKind: string;
};

type GoalItem = {
  id: string;
  context: "STUDIO" | "PERSONAL";
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
};

type StudioAppointmentItem = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  startAt: string;
  status: string;
  preferredPaymentMethod: string;
  priceEstimate: number;
  depositRequired: number;
  receivedAmount: number;
};

type CashClosingItem = {
  id: string;
  periodDate: string;
  periodEndDate: string | null;
  periodLabel: string | null;
  grossRevenue: number;
  totalExpenses: number;
  netResult: number;
  pixTotal: number;
  cardTotal: number;
  cashTotal: number;
  commissionPercent: number;
  commissionAmount: number;
  studioShareAmount: number;
  countedCash: number | null;
  cashDifference: number | null;
  transferredToPersonal: boolean;
  notes: string | null;
  closedByName: string;
  createdAt: string;
};

function shiftMonth(ym: string, offset: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function shiftDateISO(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00-03:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + delta);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function formatMonthLabelPT(ym: string): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "Todo histórico";
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, 15)));
}

function formatDayGroupLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return "Hoje";
  const d = new Date(`${dateStr}T12:00:00-03:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    weekday: "short",
  }).format(d);
}

function FinanceInner({
  fixedContext,
  isOwner,
  hideValues,
  todayStr,
  currentMonth,
  initialAccounts,
  transferAccounts,
  initialCards,
  initialCategories,
  initialTransactions,
  initialTransfers,
  initialGoals,
  projects,
  studioAppointments = [],
  initialCommissionPercent = 30,
  initialClosings = [],
}: {
  fixedContext: "STUDIO" | "PERSONAL";
  isOwner: boolean;
  hideValues: boolean;
  todayStr: string;
  currentMonth: string;
  initialAccounts: AccountItem[];
  transferAccounts: TransferAccountItem[];
  initialCards: CardItem[];
  initialCategories: CategoryItem[];
  initialTransactions: TxItem[];
  initialTransfers: TransferItem[];
  initialGoals: GoalItem[];
  projects: Array<{ id: string; name: string }>;
  studioAppointments?: StudioAppointmentItem[];
  initialCommissionPercent?: number;
  initialClosings?: CashClosingItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialNovo = searchParams.get("novo");
  const isStudio = fixedContext === "STUDIO";

  const [periodMode, setPeriodMode] = useState<
    "MONTH" | "DAY" | "CUSTOM" | "ALL"
  >("MONTH");
  const [monthFilter, setMonthFilter] = useState<string>(currentMonth);
  const [dayFilter, setDayFilter] = useState<string>(todayStr);
  const [customFrom, setCustomFrom] = useState<string>(`${currentMonth}-01`);
  const [customTo, setCustomTo] = useState<string>(todayStr);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [showCharts, setShowCharts] = useState(true);

  const [mainView, setMainView] = useState<
    "extrato" | "agendamentos" | "gerenciar"
  >("extrato");
  const [txTypeFilter, setTxTypeFilter] = useState<
    "ALL" | "INCOME" | "EXPENSE" | "PENDING"
  >("ALL");

  const [selectedTx, setSelectedTx] = useState<TxItem | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(
    initialNovo === "INCOME" || initialNovo === "EXPENSE"
  );
  const [showTxAdvanced, setShowTxAdvanced] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);

  const defaultTxType: "INCOME" | "EXPENSE" =
    initialNovo === "INCOME"
      ? "INCOME"
      : initialNovo === "EXPENSE"
        ? "EXPENSE"
        : isStudio
          ? "INCOME"
          : "EXPENSE";

  const [txType, setTxType] = useState<"INCOME" | "EXPENSE">(defaultTxType);
  const [txDesc, setTxDesc] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txCompDate, setTxCompDate] = useState(todayStr);
  const [txDueDate, setTxDueDate] = useState(todayStr);
  const [txStatus, setTxStatus] = useState(
    defaultTxType === "INCOME" ? "RECEIVED" : "PAID"
  );
  const [txCategoryId, setTxCategoryId] = useState("");
  const [txCustomCategoryName, setTxCustomCategoryName] = useState("");
  const [txAccountId, setTxAccountId] = useState(initialAccounts[0]?.id || "");
  const [txCardId, setTxCardId] = useState("");
  const [txMethod, setTxMethod] = useState("PIX");
  const [txInstallments, setTxInstallments] = useState(1);
  const [txRecurring, setTxRecurring] = useState(1);
  const [txProjectId, setTxProjectId] = useState("");
  const [txAppointmentId, setTxAppointmentId] = useState<string | null>(null);
  const [txAttachmentId, setTxAttachmentId] = useState<string | null>(null);
  const [txNotes, setTxNotes] = useState("");

  // Form retirada de comissão fixa (Estúdio -> Pessoal)
  const studioTransferAccounts = useMemo(
    () => transferAccounts.filter((a) => a.context === "STUDIO"),
    [transferAccounts]
  );
  const personalTransferAccounts = useMemo(
    () => transferAccounts.filter((a) => a.context === "PERSONAL"),
    [transferAccounts]
  );
  const [trFrom, setTrFrom] = useState(studioTransferAccounts[0]?.id || "");
  const [trTo, setTrTo] = useState(personalTransferAccounts[0]?.id || "");
  const [trAmount, setTrAmount] = useState("");
  const [trDate, setTrDate] = useState(todayStr);
  const [trDesc, setTrDesc] = useState("Retirada de comissão");
  const trKind = "OWNER_WITHDRAWAL";

  // Forms de gestão
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("BANK");
  const [accInstitution, setAccInstitution] = useState("");
  const [accInitial, setAccInitial] = useState("0");

  const [cardName, setCardName] = useState("");
  const [cardBrand, setCardBrand] = useState("Mastercard");
  const [cardLast4, setCardLast4] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [cardClosing, setCardClosing] = useState(10);
  const [cardDue, setCardDue] = useState(17);

  const [catKind, setCatKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [catName, setCatName] = useState("");
  const [catLimit, setCatLimit] = useState("");
  const [catParentId, setCatParentId] = useState("");

  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("0");
  const [goalDate, setGoalDate] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fechamento de Caixa & Comissão sobre Faturamento
  const [commissionPctInput, setCommissionPctInput] = useState(
    String(initialCommissionPercent ?? 30)
  );
  const [savedCommissionPct, setSavedCommissionPct] = useState(
    initialCommissionPercent ?? 30
  );
  const [savingCommission, setSavingCommission] = useState(false);
  const [commissionFeedback, setCommissionFeedback] = useState<string | null>(
    null
  );
  const [closingModalOpen, setClosingModalOpen] = useState(false);
  const [closingCountedCash, setClosingCountedCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [closingTransferEnabled, setClosingTransferEnabled] = useState(false);
  const [closingFromAccount, setClosingFromAccount] = useState(
    studioTransferAccounts[0]?.id || ""
  );
  const [closingToAccount, setClosingToAccount] = useState(
    personalTransferAccounts[0]?.id || ""
  );
  const [deleteClosingId, setDeleteClosingId] = useState<string | null>(null);

  const parsedCommissionPct = useMemo(() => {
    const raw = Number(commissionPctInput.replace(",", "."));
    if (!Number.isFinite(raw)) return 0;
    return Math.min(100, Math.max(0, Math.round(raw * 100) / 100));
  }, [commissionPctInput]);

  const matchesSelectedPeriod = useMemo(() => {
    return (dateISO: string) => {
      const ymd = dateISO.slice(0, 10);
      if (periodMode === "MONTH") {
        return ymd.startsWith(monthFilter);
      }
      if (periodMode === "DAY") {
        return ymd === dayFilter;
      }
      if (periodMode === "CUSTOM") {
        const start = customFrom <= customTo ? customFrom : customTo;
        const end = customFrom <= customTo ? customTo : customFrom;
        return ymd >= start && ymd <= end;
      }
      return true;
    };
  }, [periodMode, monthFilter, dayFilter, customFrom, customTo]);

  const periodTx = useMemo(() => {
    return initialTransactions.filter((t) => {
      if (t.context !== fixedContext) return false;
      return matchesSelectedPeriod(t.competenceDate);
    });
  }, [initialTransactions, fixedContext, matchesSelectedPeriod]);

  const filteredTx = useMemo(() => {
    return periodTx.filter((t) => {
      if (txTypeFilter === "INCOME") return t.type === "INCOME";
      if (txTypeFilter === "EXPENSE") return t.type === "EXPENSE";
      if (txTypeFilter === "PENDING")
        return t.status === "PENDING" || t.status === "OVERDUE";
      return true;
    });
  }, [periodTx, txTypeFilter]);

  // Agrupamento estilo Apple Wallet / Nubank por dia
  const groupedTx = useMemo(() => {
    const groups: Array<{ dateKey: string; items: TxItem[] }> = [];
    const map = new Map<string, TxItem[]>();
    for (const item of filteredTx) {
      const list = map.get(item.competenceDate) || [];
      list.push(item);
      map.set(item.competenceDate, list);
    }
    for (const [dateKey, items] of map.entries()) {
      groups.push({ dateKey, items });
    }
    return groups;
  }, [filteredTx]);

  const filteredAppointments = useMemo(() => {
    if (!isStudio) return [];
    return studioAppointments.filter((a) =>
      matchesSelectedPeriod(a.startAt)
    );
  }, [isStudio, studioAppointments, matchesSelectedPeriod]);

  const pendingAppointments = useMemo(
    () =>
      filteredAppointments.filter(
        (a) => a.priceEstimate > 0 && a.priceEstimate - a.receivedAmount > 0.01
      ),
    [filteredAppointments]
  );

  const metrics = useMemo(() => {
    const settledIn = periodTx
      .filter((t) => t.type === "INCOME" && t.status === "RECEIVED")
      .reduce((acc, t) => acc + t.amount, 0);
    const settledOut = periodTx
      .filter((t) => t.type === "EXPENSE" && t.status === "PAID")
      .reduce((acc, t) => acc + t.amount, 0);
    const pendingIn = periodTx
      .filter(
        (t) =>
          t.type === "INCOME" &&
          (t.status === "PENDING" || t.status === "OVERDUE")
      )
      .reduce((acc, t) => acc + t.amount, 0);
    const pendingOut = periodTx
      .filter(
        (t) =>
          t.type === "EXPENSE" &&
          (t.status === "PENDING" || t.status === "OVERDUE")
      )
      .reduce((acc, t) => acc + t.amount, 0);

    const pixIn = periodTx
      .filter(
        (t) =>
          t.type === "INCOME" &&
          t.status === "RECEIVED" &&
          t.paymentMethod === "PIX"
      )
      .reduce((acc, t) => acc + t.amount, 0);
    const cardIn = periodTx
      .filter(
        (t) =>
          t.type === "INCOME" &&
          t.status === "RECEIVED" &&
          (t.paymentMethod === "CREDIT_CARD" || t.paymentMethod === "DEBIT_CARD")
      )
      .reduce((acc, t) => acc + t.amount, 0);
    const cashIn = periodTx
      .filter(
        (t) =>
          t.type === "INCOME" &&
          t.status === "RECEIVED" &&
          t.paymentMethod === "CASH"
      )
      .reduce((acc, t) => acc + t.amount, 0);

    const appointmentsPending = filteredAppointments.reduce(
      (acc, a) => acc + Math.max(0, a.priceEstimate - a.receivedAmount),
      0
    );

    const accountsBalance = initialAccounts.reduce(
      (acc, a) => acc + a.currentBalance,
      0
    );

    return {
      settledIn,
      settledOut,
      netResult: settledIn - settledOut,
      pendingIn,
      pendingOut,
      pixIn,
      cardIn,
      cashIn,
      appointmentsPending,
      accountsBalance,
    };
  }, [periodTx, filteredAppointments, initialAccounts]);

  const activeMonthKey = useMemo(
    () => (periodMode === "DAY" ? dayFilter.slice(0, 7) : monthFilter),
    [periodMode, dayFilter, monthFilter]
  );

  const txMarkedDates = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of initialTransactions) {
      if (t.context !== fixedContext) continue;
      map.set(t.competenceDate, (map.get(t.competenceDate) || 0) + 1);
    }
    return map;
  }, [initialTransactions, fixedContext]);

  const monthDailySummary = useMemo(() => {
    const map = new Map<
      string,
      { dateKey: string; income: number; expense: number; count: number }
    >();
    for (const t of initialTransactions) {
      if (t.context !== fixedContext || t.status === "CANCELLED") continue;
      if (!t.competenceDate.startsWith(activeMonthKey)) continue;
      const prev = map.get(t.competenceDate) || {
        dateKey: t.competenceDate,
        income: 0,
        expense: 0,
        count: 0,
      };
      if (t.type === "INCOME") prev.income += t.amount;
      else prev.expense += t.amount;
      prev.count += 1;
      map.set(t.competenceDate, prev);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey)
    );
  }, [initialTransactions, fixedContext, activeMonthKey]);

  const expenseCategoryChart = useMemo(() => {
    const palette = [
      "#C9B18F",
      "#F87171",
      "#60A5FA",
      "#34D399",
      "#FBBF24",
      "#A78BFA",
      "#FB923C",
    ];
    const map = new Map<string, number>();
    let total = 0;
    for (const t of periodTx) {
      if (t.type !== "EXPENSE" || t.status === "CANCELLED") continue;
      total += t.amount;
      map.set(t.categoryName, (map.get(t.categoryName) || 0) + t.amount);
    }
    const items = Array.from(map.entries())
      .map(([name, amount], idx) => ({
        name,
        amount,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
        color: palette[idx % palette.length],
      }))
      .sort((a, b) => b.amount - a.amount);
    return { total, items };
  }, [periodTx]);

  const monthCalendarCells = useMemo(() => {
    const [y, m] = activeMonthKey.split("-").map(Number);
    if (!y || !m) return [];
    const firstDay = new Date(Date.UTC(y, m - 1, 1, 12)).getUTCDay();
    const totalDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: Array<{ dayNum: number; dateKey: string } | null> = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      cells.push({
        dayNum: d,
        dateKey: `${activeMonthKey}-${String(d).padStart(2, "0")}`,
      });
    }
    return cells;
  }, [activeMonthKey]);

  const formCategories = useMemo(
    () =>
      initialCategories.filter(
        (c) => c.context === fixedContext && c.kind === txType
      ),
    [initialCategories, fixedContext, txType]
  );

  const openNewTxModal = (
    type: "INCOME" | "EXPENSE",
    preset?: {
      description?: string;
      amount?: number;
      appointmentId?: string;
      paymentMethod?: string;
    }
  ) => {
    setError(null);
    setTxType(type);
    setTxStatus(type === "INCOME" ? "RECEIVED" : "PAID");
    setTxCategoryId("");
    setTxCustomCategoryName("");
    setTxDesc(preset?.description || "");
    setTxAmount(
      preset?.amount && preset.amount > 0 ? preset.amount.toFixed(2) : ""
    );
    setTxAppointmentId(preset?.appointmentId || null);
    setTxMethod(preset?.paymentMethod || "PIX");
    setTxCompDate(todayStr);
    setTxDueDate(todayStr);
    setShowTxAdvanced(false);
    setTxModalOpen(true);
  };

  const handleUploadReceipt = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("visibility", "ADMIN_PRIVATE");
    const res = await fetch("/api/files", { method: "POST", body: fd });
    if (res.ok) {
      const data = await res.json();
      setTxAttachmentId(data.file.id);
    }
  };

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const isCustomCat =
        txCategoryId === "__CUSTOM__" || formCategories.length === 0;
      const customName = txCustomCategoryName.trim();
      const catId = !isCustomCat
        ? txCategoryId || formCategories[0]?.id || ""
        : "";
      if (isCustomCat && !customName) {
        setError("Digite o nome da nova categoria.");
        return;
      }
      if (!isCustomCat && !catId) {
        setError("Selecione ou digite uma categoria.");
        return;
      }
      const res = await fetch("/api/admin/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: fixedContext,
          type: txType,
          description: txDesc,
          amount: Number(txAmount),
          competenceDate: txCompDate,
          dueDate: txDueDate,
          status: txStatus,
          categoryId: catId || undefined,
          customCategoryName: isCustomCat ? customName : undefined,
          accountId: txMethod === "CREDIT_CARD" ? null : txAccountId || null,
          creditCardId: txMethod === "CREDIT_CARD" ? txCardId || null : null,
          paymentMethod: txMethod,
          totalInstallments: Number(txInstallments || 1),
          recurringMonths: Number(txRecurring || 1),
          projectId: txProjectId || null,
          appointmentId: txAppointmentId || null,
          attachmentFileId: txAttachmentId,
          notes: txNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao registrar lançamento.");
        return;
      }
      setTxModalOpen(false);
      setTxDesc("");
      setTxAmount("");
      setTxCustomCategoryName("");
      setTxNotes("");
      setTxAppointmentId(null);
      setTxAttachmentId(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleSettleTx = async (tx: TxItem) => {
    setSaving(true);
    try {
      await fetch(`/api/admin/finance/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: tx.type === "INCOME" ? "RECEIVED" : "PAID",
        }),
      });
      setSelectedTx(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTx = async () => {
    if (!deleteTxId) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/finance/transactions/${deleteTxId}`, {
        method: "DELETE",
      });
      setDeleteTxId(null);
      setSelectedTx(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/finance/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId: trFrom,
          toAccountId: trTo,
          amount: Number(trAmount),
          transferDate: trDate,
          description: trDesc,
          transferKind: trKind,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao transferir.");
        return;
      }
      setTransferModalOpen(false);
      setTrAmount("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCommissionPercent = async () => {
    setSavingCommission(true);
    setCommissionFeedback(null);
    try {
      const res = await fetch("/api/admin/finance/closings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionPercent: parsedCommissionPct }),
      });
      if (res.ok) {
        setSavedCommissionPct(parsedCommissionPct);
        setCommissionPctInput(String(parsedCommissionPct));
        setCommissionFeedback("Salva!");
        setTimeout(() => setCommissionFeedback(null), 2500);
        router.refresh();
      }
    } finally {
      setSavingCommission(false);
    }
  };

  const openClosingModal = () => {
    setError(null);
    setClosingCountedCash("");
    setClosingNotes("");
    setClosingTransferEnabled(false);
    setClosingFromAccount((prev) => prev || studioTransferAccounts[0]?.id || "");
    setClosingToAccount((prev) => prev || personalTransferAccounts[0]?.id || "");
    setClosingModalOpen(true);
  };

  const handleCreateCashClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const periodDate =
      periodMode === "DAY"
        ? dayFilter
        : periodMode === "CUSTOM"
        ? customFrom <= customTo
          ? customFrom
          : customTo
        : periodMode === "MONTH"
        ? `${monthFilter}-01`
        : todayStr;

    const periodEndDate =
      periodMode === "CUSTOM"
        ? customFrom <= customTo
          ? customTo
          : customFrom
        : periodMode === "MONTH"
        ? `${monthFilter}-${String(
            new Date(
              Date.UTC(
                Number(monthFilter.slice(0, 4)),
                Number(monthFilter.slice(5, 7)),
                0
              )
            ).getUTCDate()
          ).padStart(2, "0")}`
        : null;

    const parsedCounted =
      closingCountedCash.trim() !== "" ? Number(closingCountedCash) : null;

    try {
      const res = await fetch("/api/admin/finance/closings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodDate,
          periodEndDate,
          periodLabel,
          grossRevenue: metrics.settledIn,
          totalExpenses: metrics.settledOut,
          netResult: metrics.netResult,
          pixTotal: metrics.pixIn,
          cardTotal: metrics.cardIn,
          cashTotal: metrics.cashIn,
          commissionPercent: parsedCommissionPct,
          countedCash:
            parsedCounted !== null && Number.isFinite(parsedCounted)
              ? parsedCounted
              : null,
          notes: closingNotes.trim() || undefined,
          transferCommission:
            closingTransferEnabled &&
            closingFromAccount &&
            closingToAccount &&
            isOwner
              ? {
                  fromAccountId: closingFromAccount,
                  toAccountId: closingToAccount,
                }
              : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Erro ao registrar fechamento de caixa.");
        return;
      }
      setSavedCommissionPct(parsedCommissionPct);
      setClosingModalOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClosing = async () => {
    if (!deleteClosingId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/finance/closings?id=${encodeURIComponent(deleteClosingId)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setDeleteClosingId(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreateConfigEntity = async (
    payload: Record<string, unknown>,
    close: () => void
  ) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível salvar.");
        return;
      }
      close();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const periodLabel =
    periodMode === "MONTH"
      ? formatMonthLabelPT(monthFilter)
      : periodMode === "DAY"
        ? formatDateBR(dayFilter)
        : periodMode === "CUSTOM"
          ? `${formatDateBR(customFrom).slice(0, 5)} – ${formatDateBR(customTo).slice(0, 5)}`
          : "Todo histórico";

  const exportUrlBase = `/api/admin/finance/export?context=${fixedContext}${
    periodMode === "MONTH"
      ? `&month=${monthFilter}`
      : periodMode === "DAY"
        ? `&from=${dayFilter}&to=${dayFilter}`
        : periodMode === "CUSTOM"
          ? `&from=${customFrom <= customTo ? customFrom : customTo}&to=${customFrom <= customTo ? customTo : customFrom}`
          : ""
  }`;

  return (
    <div className="space-y-4">
      {/* Topo Minimalista + Navegador de Período (Mês / Dia / Personalizado / Tudo) */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--brand-champagne)] font-semibold">
            {isStudio ? "Estúdio" : "Particular"}
          </p>
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] leading-tight">
            {isStudio ? "Financeiro" : "Pessoal"}
          </h1>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] p-1">
          <button
            type="button"
            disabled={periodMode === "ALL" || periodMode === "CUSTOM"}
            onClick={() => {
              if (periodMode === "MONTH") {
                setMonthFilter(shiftMonth(monthFilter, -1));
              } else if (periodMode === "DAY") {
                setDayFilter(shiftDateISO(dayFilter, -1));
              }
            }}
            aria-label="Período anterior"
            className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPeriodModalOpen(true)}
            title="Filtrar por dia, mês ou período personalizado"
            className="px-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] capitalize whitespace-nowrap cursor-pointer"
          >
            <span>{periodLabel}</span>
            <ChevronDown className="h-3 w-3 text-[var(--brand-champagne)]" />
          </button>
          <button
            type="button"
            disabled={periodMode === "ALL" || periodMode === "CUSTOM"}
            onClick={() => {
              if (periodMode === "MONTH") {
                setMonthFilter(shiftMonth(monthFilter, 1));
              } else if (periodMode === "DAY") {
                setDayFilter(shiftDateISO(dayFilter, 1));
              }
            }}
            aria-label="Próximo período"
            className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Seletor Rápido por Dia do Mês */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => {
            setMonthFilter(activeMonthKey);
            setPeriodMode("MONTH");
          }}
          className={`h-8 px-3 rounded-full text-xs font-medium shrink-0 cursor-pointer transition-all ${
            periodMode === "MONTH"
              ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold shadow-sm"
              : "bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Mês inteiro
        </button>

        <button
          type="button"
          onClick={() => {
            setDayFilter(todayStr);
            setMonthFilter(todayStr.slice(0, 7));
            setPeriodMode("DAY");
          }}
          className={`h-8 px-3 rounded-full text-xs font-medium shrink-0 cursor-pointer transition-all tabular-nums ${
            periodMode === "DAY" && dayFilter === todayStr
              ? "bg-[var(--brand-champagne-subtle)] text-[var(--brand-champagne)] border border-[var(--brand-champagne)]/50 font-semibold"
              : "bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Hoje ({formatDateBR(todayStr).slice(0, 5)})
        </button>

        {monthDailySummary
          .filter((d) => d.dateKey !== todayStr)
          .map((d) => {
            const active = periodMode === "DAY" && dayFilter === d.dateKey;
            return (
              <button
                key={d.dateKey}
                type="button"
                onClick={() => {
                  setDayFilter(d.dateKey);
                  setPeriodMode("DAY");
                }}
                className={`h-8 px-3 rounded-full text-xs font-medium shrink-0 cursor-pointer transition-all tabular-nums inline-flex items-center gap-1.5 ${
                  active
                    ? "bg-[var(--brand-champagne-subtle)] text-[var(--brand-champagne)] border border-[var(--brand-champagne)]/50 font-semibold"
                    : "bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>{formatDateBR(d.dateKey).slice(0, 5)}</span>
                {d.expense > 0 ? (
                  <span className="text-[10px] text-[var(--status-danger)]">
                    −{formatBRL(d.expense, hideValues)}
                  </span>
                ) : null}
              </button>
            );
          })}

        <div className="shrink-0">
          <IosDatePicker
            value={periodMode === "DAY" ? dayFilter : `${activeMonthKey}-01`}
            onChange={(picked) => {
              setDayFilter(picked);
              setMonthFilter(picked.slice(0, 7));
              setPeriodMode("DAY");
            }}
            variant="icon"
            markedDates={txMarkedDates}
            ariaLabel="Escolher dia específico no calendário"
          />
        </div>
      </div>

      {/* HERO CARD ESTILO APPLE WALLET */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[var(--bg-surface)] via-[var(--bg-surface)] to-[var(--brand-champagne-subtle)] border border-[var(--border-strong)]/80 p-5 space-y-4 shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--text-secondary)]">
              {isStudio ? "Resultado do estúdio" : "Saldo do período"}
            </p>
            <p className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--text-primary)] tabular-nums mt-1">
              {formatBRL(metrics.netResult, hideValues)}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] tabular-nums mt-1">
              Em contas agora:{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {formatBRL(metrics.accountsBalance, hideValues)}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            {isStudio ? (
              <button
                type="button"
                onClick={openClosingModal}
                className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/40 text-xs font-semibold text-[var(--brand-champagne)] hover:opacity-90 cursor-pointer transition-all active:scale-[0.96]"
              >
                <Lock className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span>Fechar caixa</span>
              </button>
            ) : null}

            {isOwner && transferAccounts.length >= 2 ? (
              <button
                type="button"
                onClick={() => setTransferModalOpen(true)}
                className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-canvas)]/80 border border-[var(--border-default)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-all active:scale-[0.96]"
              >
                <ArrowLeftRight
                  className="h-3.5 w-3.5 text-[var(--brand-champagne)]"
                  strokeWidth={1.8}
                />
                <span>{isStudio ? "Retirada" : "Transferir"}</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Entrou vs Saiu limpos */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-[var(--bg-canvas)]/75 border border-[var(--border-default)] px-3.5 py-2.5 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[var(--status-success-bg)] text-[var(--status-success)] flex items-center justify-center shrink-0">
              <ArrowDownLeft className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Entrou
              </p>
              <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums truncate">
                {formatBRL(metrics.settledIn, hideValues)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--bg-canvas)]/75 border border-[var(--border-default)] px-3.5 py-2.5 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger)] flex items-center justify-center shrink-0">
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                {isStudio ? "Saiu" : "Gastos"}
              </p>
              <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums truncate">
                {formatBRL(metrics.settledOut, hideValues)}
              </p>
            </div>
          </div>
        </div>

        {/* Botões Rápidos 1-Toque */}
        <div className="grid grid-cols-2 gap-2.5 pt-0.5">
          <button
            type="button"
            onClick={() => openNewTxModal("INCOME")}
            className="h-11 rounded-2xl bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--action-primary-hover)] transition-all active:scale-[0.97] cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            <span>Nova entrada</span>
          </button>

          <button
            type="button"
            onClick={() => openNewTxModal("EXPENSE")}
            className="h-11 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-strong)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-2 hover:bg-[var(--bg-subtle)] transition-all active:scale-[0.97] cursor-pointer"
          >
            <Plus className="h-4 w-4 text-[var(--status-danger)]" strokeWidth={2.2} />
            <span>{isStudio ? "Nova saída" : "Novo gasto"}</span>
          </button>
        </div>
      </section>

      {/* Meios de Recebimento (Pix / Cartão / Dinheiro) no Estúdio */}
      {isStudio ? (
        <section className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
              <PaymentMethodIcon method="PIX" size={16} />
              <span>Pix</span>
            </div>
            <p className="text-xs sm:text-sm font-semibold tabular-nums text-[var(--text-primary)] truncate">
              {formatBRL(metrics.pixIn, hideValues)}
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
              <PaymentMethodIcon method="CREDIT_CARD" size={16} />
              <span>Cartão</span>
            </div>
            <p className="text-xs sm:text-sm font-semibold tabular-nums text-[var(--text-primary)] truncate">
              {formatBRL(metrics.cardIn, hideValues)}
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
              <PaymentMethodIcon method="CASH" size={16} />
              <span>Dinheiro</span>
            </div>
            <p className="text-xs sm:text-sm font-semibold tabular-nums text-[var(--text-primary)] truncate">
              {formatBRL(metrics.cashIn, hideValues)}
            </p>
          </div>
        </section>
      ) : null}

      {/* Comissão sobre Faturamento & Fechamento de Caixa (Estúdio) */}
      {isStudio ? (
        <section className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-default)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[var(--brand-champagne-subtle)] text-[var(--brand-champagne)] flex items-center justify-center shrink-0">
                <Percent className="h-4 w-4" strokeWidth={1.9} />
              </div>
              <div>
                <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                  Comissão sobre o faturamento
                </h2>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Calculada automaticamente sobre o total que entrou ({periodLabel})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 h-8 text-xs">
                <span className="text-[var(--text-secondary)]">Comissão:</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={commissionPctInput}
                  onChange={(e) => setCommissionPctInput(e.target.value)}
                  className="w-12 bg-transparent text-right font-semibold text-[var(--text-primary)] focus:outline-none tabular-nums text-base md:text-xs"
                  aria-label="Porcentagem de comissão"
                />
                <span className="font-semibold text-[var(--brand-champagne)]">%</span>
              </label>

              {parsedCommissionPct !== savedCommissionPct ? (
                <button
                  type="button"
                  onClick={handleSaveCommissionPercent}
                  disabled={savingCommission}
                  className="h-8 px-3 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold cursor-pointer"
                >
                  {savingCommission ? "Salvando..." : "Salvar %"}
                </button>
              ) : commissionFeedback ? (
                <span className="text-[11px] font-medium text-[var(--status-success)]">
                  {commissionFeedback}
                </span>
              ) : null}
            </div>
          </div>

          {(() => {
            const commissionValue =
              Math.round(metrics.settledIn * parsedCommissionPct) / 100;
            const studioKeepValue =
              Math.round((metrics.settledIn - commissionValue) * 100) / 100;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] px-3.5 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                    Faturamento
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                    {formatBRL(metrics.settledIn, hideValues)}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--brand-champagne-subtle)]/40 border border-[var(--brand-champagne)]/35 px-3.5 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--brand-champagne)] font-medium">
                    Comissão ({parsedCommissionPct}%)
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                    {formatBRL(commissionValue, hideValues)}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                      Parte do estúdio
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                      {formatBRL(studioKeepValue, hideValues)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openClosingModal}
                    className="h-8 px-3 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[11px] font-semibold text-[var(--text-primary)] hover:border-[var(--brand-champagne)] cursor-pointer shrink-0"
                  >
                    Fechar caixa
                  </button>
                </div>
              </div>
            );
          })()}
        </section>
      ) : null}

      {/* Alerta Prático: Agendamentos com valor pendente (Estúdio) */}
      {isStudio && pendingAppointments.length > 0 && mainView === "extrato" ? (
        <section className="rounded-2xl bg-[var(--brand-champagne-subtle)]/70 border border-[var(--brand-champagne)]/35 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                Receber de agendamentos ({pendingAppointments.length})
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                Total em aberto:{" "}
                {formatBRL(metrics.appointmentsPending, hideValues)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMainView("agendamentos")}
              className="text-xs font-semibold text-[var(--brand-champagne)] cursor-pointer"
            >
              Ver todos ›
            </button>
          </div>

          <div className="space-y-2">
            {pendingAppointments.slice(0, 3).map((appt) => {
              const remaining = Math.max(
                0,
                appt.priceEstimate - appt.receivedAmount
              );
              return (
                <div
                  key={appt.id}
                  className="p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {appt.clientName}
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate tabular-nums">
                      {appt.title} • {formatDateBR(appt.startAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openNewTxModal("INCOME", {
                        appointmentId: appt.id,
                        description: `${appt.title} — ${appt.clientName}`,
                        amount: remaining,
                        paymentMethod: appt.preferredPaymentMethod,
                      })
                    }
                    className="h-8 px-3 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold shrink-0 cursor-pointer tabular-nums"
                  >
                    + {formatBRL(remaining, hideValues)}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Controle Segmentado Limpo iOS */}
      <div
        className={`rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] p-1 grid gap-1 ${
          isStudio ? "grid-cols-3" : "grid-cols-2"
        }`}
      >
        <button
          type="button"
          onClick={() => setMainView("extrato")}
          className={`h-8 rounded-full text-xs font-medium cursor-pointer transition-all ${
            mainView === "extrato"
              ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold shadow-sm"
              : "text-[var(--text-secondary)]"
          }`}
        >
          Extrato
        </button>

        {isStudio ? (
          <button
            type="button"
            onClick={() => setMainView("agendamentos")}
            className={`h-8 rounded-full text-xs font-medium cursor-pointer transition-all ${
              mainView === "agendamentos"
                ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold shadow-sm"
                : "text-[var(--text-secondary)]"
            }`}
          >
            Agendamentos ({filteredAppointments.length})
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setMainView("gerenciar")}
          className={`h-8 rounded-full text-xs font-medium cursor-pointer transition-all ${
            mainView === "gerenciar"
              ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold shadow-sm"
              : "text-[var(--text-secondary)]"
          }`}
        >
          Gerenciar
        </button>
      </div>

      {/* GRÁFICOS FINANCEIROS ESTILO APP DE CONTROLE (Donut Categorias + Fluxo Diário) */}
      {mainView === "extrato" && (expenseCategoryChart.items.length > 0 || monthDailySummary.length > 0) ? (
        <section className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-default)] p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[var(--brand-champagne-subtle)] text-[var(--brand-champagne)] flex items-center justify-center">
                <PieChart className="h-4 w-4" strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                  Resumo gráfico ({periodLabel})
                </h2>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Distribuição por categoria e movimentação diária
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCharts((v) => !v)}
              className="h-8 px-3 rounded-full bg-[var(--bg-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{showCharts ? "Ocultar" : "Mostrar"}</span>
              {showCharts ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {showCharts ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
              {/* Gráfico 1: Rosca por Categoria */}
              <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] p-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <PieChart className="h-3.5 w-3.5 text-[var(--brand-champagne)]" />
                  {isStudio ? "Saídas por categoria" : "Gastos por categoria"}
                </p>

                {expenseCategoryChart.items.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)] py-6 text-center">
                    Nenhum gasto registrado neste período.
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Donut SVG */}
                    <div className="relative h-36 w-36 shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                        <circle
                          cx="60"
                          cy="60"
                          r="44"
                          fill="none"
                          stroke="var(--border-default)"
                          strokeWidth="14"
                        />
                        {(() => {
                          const circ = 2 * Math.PI * 44;
                          let offset = 0;
                          return expenseCategoryChart.items.map((cat) => {
                            const frac =
                              expenseCategoryChart.total > 0
                                ? cat.amount / expenseCategoryChart.total
                                : 0;
                            const dash = Math.max(0, frac * circ);
                            const currentOffset = offset;
                            offset += dash;
                            return (
                              <circle
                                key={cat.name}
                                cx="60"
                                cy="60"
                                r="44"
                                fill="none"
                                stroke={cat.color}
                                strokeWidth="14"
                                strokeDasharray={`${dash} ${circ - dash}`}
                                strokeDashoffset={-currentOffset}
                                strokeLinecap={
                                  expenseCategoryChart.items.length === 1
                                    ? "round"
                                    : "butt"
                                }
                              />
                            );
                          });
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                          Total
                        </span>
                        <span className="text-xs font-bold tabular-nums text-[var(--text-primary)] truncate max-w-[90px]">
                          {formatBRL(expenseCategoryChart.total, hideValues)}
                        </span>
                      </div>
                    </div>

                    {/* Lista ranqueada com barras */}
                    <div className="flex-1 w-full space-y-2.5 min-w-0">
                      {expenseCategoryChart.items.slice(0, 5).map((cat) => (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="inline-flex items-center gap-1.5 min-w-0">
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="font-medium text-[var(--text-primary)] truncate">
                                {cat.name}
                              </span>
                            </span>
                            <span className="tabular-nums text-[var(--text-secondary)] shrink-0 text-[11px]">
                              <strong className="text-[var(--text-primary)]">
                                {formatBRL(cat.amount, hideValues)}
                              </strong>{" "}
                              ({cat.percent}%)
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.max(4, cat.percent)}%`,
                                backgroundColor: cat.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Gráfico 2: Barras por Dia do Mês (clicável para filtrar o dia) */}
              <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-[var(--brand-champagne)]" />
                    Fluxo por dia ({formatMonthLabelPT(activeMonthKey)})
                  </p>
                  <div className="flex items-center gap-2.5 text-[10px] text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[var(--status-success)]" />
                      Entradas
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[var(--status-danger)]" />
                      Gastos
                    </span>
                  </div>
                </div>

                {monthDailySummary.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)] py-6 text-center">
                    Sem movimentações neste mês.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="h-32 flex items-end gap-2 overflow-x-auto pb-1 pt-2">
                      {(() => {
                        const maxVal = Math.max(
                          1,
                          ...monthDailySummary.map((d) =>
                            Math.max(d.income, d.expense)
                          )
                        );
                        return monthDailySummary.map((d) => {
                          const inH =
                            d.income > 0
                              ? Math.max(10, Math.round((d.income / maxVal) * 86))
                              : 0;
                          const outH =
                            d.expense > 0
                              ? Math.max(10, Math.round((d.expense / maxVal) * 86))
                              : 0;
                          const isSelectedDay =
                            periodMode === "DAY" && dayFilter === d.dateKey;
                          return (
                            <button
                              key={d.dateKey}
                              type="button"
                              onClick={() => {
                                setDayFilter(d.dateKey);
                                setPeriodMode("DAY");
                              }}
                              title={`${formatDateBR(d.dateKey)} — Entradas: ${formatBRL(d.income, hideValues)} | Gastos: ${formatBRL(d.expense, hideValues)}`}
                              className={`flex flex-col items-center gap-1.5 px-2 py-1 rounded-xl shrink-0 cursor-pointer transition-all ${
                                isSelectedDay
                                  ? "bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/45"
                                  : "hover:bg-[var(--bg-subtle)]"
                              }`}
                            >
                              <div className="h-[88px] flex items-end gap-1">
                                {inH > 0 ? (
                                  <span
                                    className="w-2.5 rounded-t-md bg-[var(--status-success)] transition-all"
                                    style={{ height: `${inH}px` }}
                                  />
                                ) : null}
                                {outH > 0 ? (
                                  <span
                                    className="w-2.5 rounded-t-md bg-[var(--status-danger)] transition-all"
                                    style={{ height: `${outH}px` }}
                                  />
                                ) : null}
                              </div>
                              <span
                                className={`text-[10px] tabular-nums font-medium ${
                                  isSelectedDay
                                    ? "text-[var(--brand-champagne)] font-semibold"
                                    : "text-[var(--text-secondary)]"
                                }`}
                              >
                                {d.dateKey.slice(8, 10)}/{d.dateKey.slice(5, 7)}
                              </span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Toque em uma barra para filtrar o extrato e saldo daquele dia.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* VISÃO 1: EXTRATO ESTILO WALLET / NUBANK */}
      {mainView === "extrato" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {(
              [
                ["ALL", "Tudo"],
                ["INCOME", "Entradas"],
                ["EXPENSE", isStudio ? "Saídas" : "Gastos"],
                ["PENDING", "Em aberto"],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTxTypeFilter(k)}
                className={`h-8 px-3 rounded-full text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                  txTypeFilter === k
                    ? "bg-[var(--brand-champagne-subtle)] text-[var(--brand-champagne)] border border-[var(--brand-champagne)]/40 font-semibold"
                    : "bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)]"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {groupedTx.length === 0 ? (
            <div className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-default)] p-6">
              <EmptyState
                icon={<Wallet className="h-5 w-5" strokeWidth={1.5} />}
                title="Sem movimentações aqui"
                description={
                  isStudio
                    ? "Toque em Nova entrada ou Nova saída para registrar no estúdio."
                    : "Toque em Novo gasto ou Nova entrada para controlar seu caixa pessoal."
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              {groupedTx.map((group) => (
                <div key={group.dateKey} className="space-y-1.5">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)] capitalize">
                    {formatDayGroupLabel(group.dateKey, todayStr)}
                  </p>
                  <div className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-default)] divide-y divide-[var(--border-default)] overflow-hidden">
                    {group.items.map((t) => {
                      const isPending =
                        t.status === "PENDING" || t.status === "OVERDUE";
                      const isIncome = t.type === "INCOME";

                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTx(t)}
                          className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 hover:bg-[var(--bg-subtle)]/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                                isPending
                                  ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
                                  : isIncome
                                    ? "bg-[var(--status-success-bg)] text-[var(--status-success)]"
                                    : "bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                              }`}
                            >
                              {isPending ? (
                                <Clock className="h-4 w-4" strokeWidth={1.8} />
                              ) : isIncome ? (
                                <ArrowDownLeft
                                  className="h-4 w-4"
                                  strokeWidth={1.8}
                                />
                              ) : (
                                <ArrowUpRight
                                  className="h-4 w-4"
                                  strokeWidth={1.8}
                                />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                {t.description}
                              </p>
                              <p className="text-[11px] text-[var(--text-secondary)] truncate flex items-center gap-1.5">
                                <span className="truncate">{t.categoryName} •</span>
                                <span className="tabular-nums shrink-0">
                                  {formatTimeBR(t.createdAt)} •
                                </span>
                                <span className="inline-flex items-center gap-1 shrink-0">
                                  <PaymentMethodIcon method={t.paymentMethod} size={13} />
                                  {PAYMENT_METHOD_LABELS[t.paymentMethod] ||
                                    t.paymentMethod}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-2">
                            <div>
                              <p
                                className={`text-sm font-semibold tabular-nums ${
                                  isIncome
                                    ? "text-[var(--status-success)]"
                                    : "text-[var(--text-primary)]"
                                }`}
                              >
                                {isIncome ? "+" : "−"}{" "}
                                {formatBRL(t.amount, hideValues)}
                              </p>
                              {isPending ? (
                                <p className="text-[10px] font-medium text-[var(--status-warning)]">
                                  Pendente
                                </p>
                              ) : null}
                            </div>
                            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* VISÃO 2: GRANA DOS AGENDAMENTOS (Estúdio) */}
      {isStudio && mainView === "agendamentos" ? (
        filteredAppointments.length === 0 ? (
          <div className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-default)] p-6">
            <EmptyState
              icon={<Calendar className="h-5 w-5" strokeWidth={1.5} />}
              title="Nenhum agendamento no período"
              description="Quando houver sessões marcadas na Agenda, você acompanha os pagamentos aqui."
            />
          </div>
        ) : (
          <div className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-default)] divide-y divide-[var(--border-default)] overflow-hidden">
            {filteredAppointments.map((appt) => {
              const remaining = Math.max(
                0,
                appt.priceEstimate - appt.receivedAmount
              );
              const isPaidInFull =
                appt.priceEstimate > 0 && remaining <= 0.01;

              return (
                <div
                  key={appt.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold tabular-nums text-[var(--brand-champagne)]">
                        {formatDateBR(appt.startAt)} •{" "}
                        {formatTimeBR(appt.startAt)}
                      </span>
                      <StatusBadge
                        label={
                          APPOINTMENT_STATUS_LABELS[appt.status] || appt.status
                        }
                        tone={APPOINTMENT_STATUS_TONE[appt.status] || "neutral"}
                      />
                    </div>
                    <Link
                      href={`/admin/clientes/${appt.clientId}`}
                      className="text-sm font-semibold text-[var(--text-primary)] hover:underline block truncate"
                    >
                      {appt.clientName}
                    </Link>
                    <p className="text-xs text-[var(--text-secondary)] truncate flex items-center gap-1.5">
                      <span className="truncate">{appt.title} •</span>
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <PaymentMethodIcon
                          method={appt.preferredPaymentMethod}
                          size={13}
                        />
                        {PAYMENT_METHOD_LABELS[appt.preferredPaymentMethod] ||
                          appt.preferredPaymentMethod}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-left sm:text-right text-xs tabular-nums">
                      <p className="font-semibold text-[var(--text-primary)]">
                        {appt.priceEstimate > 0
                          ? formatBRL(appt.priceEstimate, hideValues)
                          : "Sem valor"}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Pago: {formatBRL(appt.receivedAmount, hideValues)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/admin/appointments/${appt.id}/receipt`}
                        target="_blank"
                        rel="noreferrer"
                        className="h-9 px-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] shrink-0"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Comprovante</span>
                      </a>

                      {isPaidInFull ? (
                        <StatusBadge label="Quitado" tone="success" />
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            openNewTxModal("INCOME", {
                              appointmentId: appt.id,
                              description: `${appt.title} — ${appt.clientName}`,
                              amount:
                                remaining > 0 ? remaining : appt.depositRequired,
                              paymentMethod: appt.preferredPaymentMethod,
                            })
                          }
                          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold cursor-pointer shrink-0"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Receber</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : null}

      {/* VISÃO 3: GERENCIAR (Contas, Cartões, Metas, Categorias, Retiradas, Relatórios) */}
      {mainView === "gerenciar" ? (
        <div className="space-y-4">
          {/* Contas */}
          <section className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-default)] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[var(--border-default)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[var(--brand-champagne)]" />
                <h2 className="font-display text-sm font-semibold">
                  Contas e carteiras
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAccountModalOpen(true)}
                className="text-xs font-semibold text-[var(--brand-champagne)] cursor-pointer"
              >
                + Adicionar
              </button>
            </div>
            {initialAccounts.length === 0 ? (
              <p className="px-4 py-5 text-xs text-[var(--text-secondary)]">
                Nenhuma conta cadastrada.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-default)]">
                {initialAccounts.map((a) => (
                  <div
                    key={a.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {ACCOUNT_TYPE_LABELS[a.type] || a.type}
                        {a.institution ? ` • ${a.institution}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatBRL(a.currentBalance, hideValues)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Cartões */}
          <section className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-default)] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[var(--border-default)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardIcon className="h-4 w-4 text-[var(--brand-champagne)]" />
                <h2 className="font-display text-sm font-semibold">
                  Cartões de crédito
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCardModalOpen(true)}
                className="text-xs font-semibold text-[var(--brand-champagne)] cursor-pointer"
              >
                + Adicionar
              </button>
            </div>
            {initialCards.length === 0 ? (
              <p className="px-4 py-5 text-xs text-[var(--text-secondary)]">
                Nenhum cartão cadastrado.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-default)]">
                {initialCards.map((c) => (
                  <div
                    key={c.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {c.name} •••• {c.last4}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {c.brand} • Vence dia {c.dueDay}
                      </p>
                    </div>
                    <span className="text-xs font-semibold tabular-nums">
                      {formatBRL(c.creditLimit, hideValues)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Metas & Categorias */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-default)] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[var(--border-default)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-[var(--brand-champagne)]" />
                  <h2 className="font-display text-sm font-semibold">Metas</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(true)}
                  className="text-xs font-semibold text-[var(--brand-champagne)] cursor-pointer"
                >
                  + Meta
                </button>
              </div>
              {initialGoals.length === 0 ? (
                <p className="px-4 py-5 text-xs text-[var(--text-secondary)]">
                  Nenhuma meta criada.
                </p>
              ) : (
                <div className="p-4 space-y-3">
                  {initialGoals.map((g) => {
                    const pct = Math.min(
                      100,
                      Math.round(
                        (g.currentAmount / Math.max(1, g.targetAmount)) * 100
                      )
                    );
                    return (
                      <div key={g.id} className="space-y-1 text-xs">
                        <div className="flex justify-between font-medium">
                          <span>{g.name}</span>
                          <span className="tabular-nums">
                            {formatBRL(g.currentAmount, hideValues)} /{" "}
                            {formatBRL(g.targetAmount, hideValues)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--status-success)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-default)] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[var(--border-default)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-[var(--brand-champagne)]" />
                  <h2 className="font-display text-sm font-semibold">
                    Categorias
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(true)}
                  className="text-xs font-semibold text-[var(--brand-champagne)] cursor-pointer"
                >
                  + Categoria
                </button>
              </div>
              <ul className="divide-y divide-[var(--border-default)] max-h-60 overflow-y-auto text-xs">
                {initialCategories.map((c) => (
                  <li
                    key={c.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-2"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {c.kind === "INCOME" ? "Entrada" : "Saída"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Retiradas de Comissão & Exportação */}
          <section className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-default)] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[var(--border-default)] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-[var(--brand-champagne)]" />
                <h2 className="font-display text-sm font-semibold">
                  Retiradas de comissão ({initialTransfers.length})
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${exportUrlBase}&format=csv`}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-xs font-medium"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  CSV
                </a>
                <a
                  href={`${exportUrlBase}&format=pdf`}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-xs font-medium"
                >
                  <Download className="h-3.5 w-3.5" />
                  PDF
                </a>
              </div>
            </div>
            {initialTransfers.length === 0 ? (
              <p className="px-4 py-4 text-xs text-[var(--text-secondary)]">
                Nenhuma retirada de comissão registrada ainda.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border-default)] text-xs">
                {initialTransfers.map((tr) => (
                  <li
                    key={tr.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {tr.description}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)] truncate">
                        {tr.fromAccountName} → {tr.toAccountName} •{" "}
                        {TRANSFER_KIND_LABELS[tr.transferKind] || tr.transferKind}{" "}
                        • {formatDateBR(tr.transferDate)}
                      </p>
                    </div>
                    <span className="font-semibold text-sm tabular-nums shrink-0">
                      {formatBRL(tr.amount, hideValues)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {isStudio ? (
            <section className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-default)] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[var(--border-default)] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[var(--brand-champagne)]" />
                  <h2 className="font-display text-sm font-semibold">
                    Histórico de fechamentos de caixa ({initialClosings.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={openClosingModal}
                  className="text-xs font-semibold text-[var(--brand-champagne)] cursor-pointer"
                >
                  + Fechar caixa
                </button>
              </div>
              {initialClosings.length === 0 ? (
                <p className="px-4 py-5 text-xs text-[var(--text-secondary)]">
                  Nenhum fechamento de caixa registrado ainda.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-default)] text-xs">
                  {initialClosings.map((c) => (
                    <li
                      key={c.id}
                      className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {c.periodLabel || formatDateBR(c.periodDate)}
                          </span>
                          {c.transferredToPersonal ? (
                            <StatusBadge
                              label="Comissão transferida"
                              tone="success"
                            />
                          ) : null}
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                          Faturamento: {formatBRL(c.grossRevenue, hideValues)} • Saídas:{" "}
                          {formatBRL(c.totalExpenses, hideValues)} • Líquido:{" "}
                          {formatBRL(c.netResult, hideValues)}
                        </p>
                        <p className="text-[11px] text-[var(--brand-champagne)] tabular-nums">
                          Comissão ({c.commissionPercent}%):{" "}
                          {formatBRL(c.commissionAmount, hideValues)} • Estúdio:{" "}
                          {formatBRL(c.studioShareAmount, hideValues)}
                          {c.cashDifference !== null
                            ? ` • Diferença dinheiro: ${formatBRL(
                                c.cashDifference,
                                hideValues
                              )}`
                            : ""}
                        </p>
                        {c.notes ? (
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {c.notes}
                          </p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        aria-label="Excluir fechamento"
                        onClick={() => setDeleteClosingId(c.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      ) : null}

      {/* MODAL DETALHE DO LANÇAMENTO (Visual Fintech + Data e Horário) */}
      {selectedTx ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTx(null);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <div className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/80 rounded-t-[28px] md:rounded-[26px] p-5 pt-3 space-y-4 overflow-y-auto shadow-2xl">
            <div className="mx-auto h-1 w-10 rounded-full bg-[var(--border-strong)] md:hidden" />

            {/* Cabeçalho visual estilo recibo digital */}
            <div className="relative rounded-2xl bg-gradient-to-br from-[var(--bg-canvas)] to-[var(--brand-champagne-subtle)]/40 border border-[var(--border-default)] p-4">
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                aria-label="Fechar detalhes"
                className="absolute top-3 right-3 h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 pr-9">
                <div
                  className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    selectedTx.type === "INCOME"
                      ? "bg-[var(--status-success-bg)] text-[var(--status-success)]"
                      : "bg-[var(--status-danger-bg)] text-[var(--status-danger)]"
                  }`}
                >
                  {selectedTx.type === "INCOME" ? (
                    <ArrowDownLeft className="h-5 w-5" strokeWidth={2} />
                  ) : (
                    <ArrowUpRight className="h-5 w-5" strokeWidth={2} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge
                      label={
                        TRANSACTION_STATUS_LABELS[selectedTx.status] ||
                        selectedTx.status
                      }
                      tone={
                        TRANSACTION_STATUS_TONE[selectedTx.status] || "neutral"
                      }
                    />
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)]">
                      {selectedTx.categoryName}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-semibold text-[var(--text-primary)] truncate mt-1">
                    {selectedTx.description}
                  </h3>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[var(--border-default)]/80 flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Valor do lançamento
                </span>
                <p
                  className={`font-display text-2xl font-semibold tabular-nums ${
                    selectedTx.type === "INCOME"
                      ? "text-[var(--status-success)]"
                      : "text-[var(--text-primary)]"
                  }`}
                >
                  {selectedTx.type === "INCOME" ? "+" : "−"}{" "}
                  {formatBRL(selectedTx.amount, hideValues)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] divide-y divide-[var(--border-default)] text-xs">
              <div className="px-4 py-2.5 flex justify-between items-center gap-2">
                <span className="text-[var(--text-secondary)] inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[var(--brand-champagne)]" />
                  Data e horário
                </span>
                <span className="font-medium tabular-nums">
                  {formatDateBR(selectedTx.competenceDate)} às{" "}
                  {formatTimeBR(selectedTx.createdAt)}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between items-center gap-2">
                <span className="text-[var(--text-secondary)] inline-flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-[var(--brand-champagne)]" />
                  Categoria
                </span>
                <span className="font-medium">{selectedTx.categoryName}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between items-center gap-2">
                <span className="text-[var(--text-secondary)]">Pagamento</span>
                <span className="font-medium inline-flex items-center gap-1.5">
                  <PaymentMethodIcon method={selectedTx.paymentMethod} size={16} />
                  {PAYMENT_METHOD_LABELS[selectedTx.paymentMethod] ||
                    selectedTx.paymentMethod}
                </span>
              </div>
              {selectedTx.accountName || selectedTx.creditCardName ? (
                <div className="px-4 py-2.5 flex justify-between gap-2">
                  <span className="text-[var(--text-secondary)]">
                    Conta / Cartão
                  </span>
                  <span className="font-medium">
                    {selectedTx.accountName || selectedTx.creditCardName}
                  </span>
                </div>
              ) : null}
              {selectedTx.dueDate &&
              selectedTx.dueDate !== selectedTx.competenceDate ? (
                <div className="px-4 py-2.5 flex justify-between gap-2">
                  <span className="text-[var(--text-secondary)]">
                    Vencimento
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatDateBR(selectedTx.dueDate)}
                  </span>
                </div>
              ) : null}
              {selectedTx.notes ? (
                <div className="px-4 py-2.5 space-y-1">
                  <span className="text-[var(--text-secondary)] block">
                    Observações
                  </span>
                  <p className="text-[var(--text-primary)]">
                    {selectedTx.notes}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/admin/finance/transactions/${selectedTx.id}/receipt`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 px-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-xs font-medium text-[var(--text-primary)]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Comprovante PDF
                </a>
                {selectedTx.attachmentFileId ? (
                  <a
                    href={`/api/files/${selectedTx.attachmentFileId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 px-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-xs font-medium"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Anexo
                  </a>
                ) : null}
                {(selectedTx.status === "PENDING" ||
                  selectedTx.status === "OVERDUE") ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => handleSettleTx(selectedTx)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirmar
                  </Button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setDeleteTxId(selectedTx.id)}
                className="h-9 px-3 inline-flex items-center gap-1.5 rounded-full text-xs font-medium text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Novo Lançamento */}
      {txModalOpen ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setTxModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <form
            onSubmit={handleCreateTx}
            className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/80 rounded-t-[28px] md:rounded-[26px] p-5 pt-3 space-y-3.5 overflow-y-auto shadow-2xl"
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-[var(--border-strong)] md:hidden" />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-9 w-9 rounded-2xl flex items-center justify-center shrink-0 ${
                    txType === "INCOME"
                      ? "bg-[var(--status-success-bg)] text-[var(--status-success)]"
                      : "bg-[var(--status-danger-bg)] text-[var(--status-danger)]"
                  }`}
                >
                  {txType === "INCOME" ? (
                    <ArrowDownLeft className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                  )}
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold leading-tight">
                    {txType === "INCOME"
                      ? "Nova entrada"
                      : isStudio
                        ? "Nova saída do estúdio"
                        : "Novo gasto pessoal"}
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {isStudio ? "Caixa do estúdio" : "Controle financeiro particular"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTxModalOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Alternador rápido Entrada / Gasto */}
            <div className="rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] p-1 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => {
                  setTxType("INCOME");
                  setTxStatus("RECEIVED");
                  setTxCategoryId("");
                  setTxCustomCategoryName("");
                }}
                className={`h-8 rounded-full text-xs font-medium cursor-pointer transition-all ${
                  txType === "INCOME"
                    ? "bg-[var(--status-success-bg)] text-[var(--status-success)] font-semibold"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                Entrada
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxType("EXPENSE");
                  setTxStatus("PAID");
                  setTxCategoryId("");
                  setTxCustomCategoryName("");
                }}
                className={`h-8 rounded-full text-xs font-medium cursor-pointer transition-all ${
                  txType === "EXPENSE"
                    ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)] font-semibold"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {isStudio ? "Saída / Gasto" : "Gasto"}
              </button>
            </div>

            {error ? (
              <div className="p-2.5 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
                {error}
              </div>
            ) : null}

            <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] p-3.5 grid grid-cols-2 gap-2.5">
              <Field label="Valor">
                <CurrencyInput
                  value={txAmount}
                  onValueChange={setTxAmount}
                  required
                />
              </Field>
              <Field label="Data">
                <IosDatePicker
                  value={txCompDate}
                  onChange={(d) => {
                    setTxCompDate(d);
                    setTxDueDate(d);
                  }}
                />
              </Field>
            </div>

            <Field label="Descrição">
              <Input
                value={txDesc}
                onChange={(e) => setTxDesc(e.target.value)}
                placeholder={
                  isStudio
                    ? "Ex: Sessão Fine Line ou Agulhas"
                    : "Ex: Mercado, Aluguel, Lazer"
                }
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Categoria">
                <Select
                  value={
                    formCategories.length === 0
                      ? "__CUSTOM__"
                      : txCategoryId || formCategories[0]?.id || "__CUSTOM__"
                  }
                  onChange={(e) => setTxCategoryId(e.target.value)}
                  required
                >
                  {formCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__CUSTOM__">+ Digitar nova categoria...</option>
                </Select>
              </Field>
              <Field label="Pagamento">
                <Select
                  value={
                    txMethod === "DEBIT_CARD"
                      ? "CREDIT_CARD"
                      : txMethod === "BANK_TRANSFER"
                      ? "PIX"
                      : txMethod
                  }
                  onChange={(e) => setTxMethod(e.target.value)}
                >
                  <option value="PIX">Pix</option>
                  <option value="CREDIT_CARD">Cartão</option>
                  <option value="CASH">Dinheiro</option>
                </Select>
              </Field>
            </div>

            {txCategoryId === "__CUSTOM__" || formCategories.length === 0 ? (
              <Field label="Nome da nova categoria">
                <Input
                  value={txCustomCategoryName}
                  onChange={(e) => setTxCustomCategoryName(e.target.value)}
                  placeholder="Ex: Farmácia, Gasolina, Curso, Fornecedor"
                  required
                  autoFocus
                />
              </Field>
            ) : null}

            {txMethod === "CREDIT_CARD" ? (
              <Field label="Cartão">
                <Select
                  value={txCardId}
                  onChange={(e) => setTxCardId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {initialCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (•••• {c.last4})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Conta / carteira">
                <Select
                  value={txAccountId}
                  onChange={(e) => setTxAccountId(e.target.value)}
                >
                  <option value="">Sem vínculo</option>
                  {initialAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <button
              type="button"
              onClick={() => setShowTxAdvanced((v) => !v)}
              className="w-full py-2 px-3 rounded-xl bg-[var(--bg-subtle)]/70 border border-[var(--border-default)] flex items-center justify-between text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <span>Mais opções (status, parcelas, comprovante)</span>
              {showTxAdvanced ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {showTxAdvanced ? (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Status">
                    <Select
                      value={txStatus}
                      onChange={(e) => setTxStatus(e.target.value)}
                    >
                      <option value={txType === "INCOME" ? "RECEIVED" : "PAID"}>
                        {txType === "INCOME" ? "Recebido" : "Pago"}
                      </option>
                      <option value="PENDING">Pendente</option>
                      <option value="OVERDUE">Vencido</option>
                    </Select>
                  </Field>
                  <Field label="Vencimento">
                    <IosDatePicker value={txDueDate} onChange={setTxDueDate} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Parcelas">
                    <Input
                      type="number"
                      min={1}
                      max={36}
                      value={txInstallments}
                      onChange={(e) =>
                        setTxInstallments(Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Repetir (meses)">
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={txRecurring}
                      onChange={(e) => setTxRecurring(Number(e.target.value))}
                    />
                  </Field>
                </div>

                {isStudio && projects.length > 0 ? (
                  <Field label="Projeto (opcional)">
                    <Select
                      value={txProjectId}
                      onChange={(e) => setTxProjectId(e.target.value)}
                    >
                      <option value="">Nenhum</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}

                <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
                  <Paperclip className="h-3.5 w-3.5" strokeWidth={1.6} />
                  {txAttachmentId ? "Comprovante anexado" : "Anexar comprovante"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleUploadReceipt}
                  />
                </label>

                <Field label="Observações">
                  <Textarea
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    className="min-h-[52px]"
                  />
                </Field>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTxModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Modal Retirada de Comissão Fixa (Estúdio -> Pessoal) */}
      {transferModalOpen && isOwner ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setTransferModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <form
            onSubmit={handleCreateTransfer}
            className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/80 rounded-t-[28px] md:rounded-[26px] p-5 space-y-3 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold">
                  Retirada de Comissão
                </h3>
                <p className="text-[11px] text-[var(--brand-champagne)] font-medium">
                  Estúdio → Conta Pessoal
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {error ? (
              <div className="p-2.5 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
                {error}
              </div>
            ) : null}
            <Field label="Saindo do Estúdio">
              <Select
                value={trFrom}
                onChange={(e) => setTrFrom(e.target.value)}
                required
              >
                {studioTransferAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Entrando no Pessoal">
              <Select
                value={trTo}
                onChange={(e) => setTrTo(e.target.value)}
                required
              >
                {personalTransferAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Valor">
                <CurrencyInput
                  value={trAmount}
                  onValueChange={setTrAmount}
                  required
                />
              </Field>
              <Field label="Data">
                <IosDatePicker value={trDate} onChange={setTrDate} />
              </Field>
            </div>
            <Field label="Descrição">
              <Input
                value={trDesc}
                onChange={(e) => setTrDesc(e.target.value)}
                required
              />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTransferModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  saving ||
                  studioTransferAccounts.length === 0 ||
                  personalTransferAccounts.length === 0
                }
              >
                {saving ? "Registrando..." : "Registrar retirada"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Modal Nova Conta */}
      {accountModalOpen ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setAccountModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateConfigEntity(
                {
                  entity: "account",
                  context: fixedContext,
                  name: accName,
                  type: accType,
                  institution: accInstitution,
                  initialBalance: Number(accInitial || 0),
                },
                () => {
                  setAccountModalOpen(false);
                  setAccName("");
                }
              );
            }}
            className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/80 rounded-t-[28px] md:rounded-[26px] p-5 space-y-3 overflow-y-auto shadow-2xl"
          >
            <h3 className="font-display text-base font-semibold">
              {isStudio ? "Nova conta do Estúdio" : "Nova conta Pessoal"}
            </h3>
            <Field label="Tipo">
              <Select
                value={accType}
                onChange={(e) => setAccType(e.target.value)}
              >
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nome da conta">
              <Input
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Banco">
                <Input
                  value={accInstitution}
                  onChange={(e) => setAccInstitution(e.target.value)}
                />
              </Field>
              <Field label="Saldo inicial">
                <CurrencyInput
                  value={accInitial}
                  onValueChange={setAccInitial}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAccountModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Salvar
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Modal Novo Cartão */}
      {cardModalOpen ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setCardModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateConfigEntity(
                {
                  entity: "card",
                  context: fixedContext,
                  name: cardName,
                  brand: cardBrand,
                  last4: cardLast4,
                  creditLimit: Number(cardLimit || 0),
                  closingDay: Number(cardClosing),
                  dueDay: Number(cardDue),
                },
                () => {
                  setCardModalOpen(false);
                  setCardName("");
                }
              );
            }}
            className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/80 rounded-t-[28px] md:rounded-[26px] p-5 space-y-3 overflow-y-auto shadow-2xl"
          >
            <h3 className="font-display text-base font-semibold">
              {isStudio ? "Novo cartão do Estúdio" : "Novo cartão Pessoal"}
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Nome">
                <Input
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Bandeira">
                <Input
                  value={cardBrand}
                  onChange={(e) => setCardBrand(e.target.value)}
                  required
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="4 últimos dígitos">
                <Input
                  mask="digits"
                  maxLength={4}
                  inputMode="numeric"
                  value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value)}
                  required
                />
              </Field>
              <Field label="Limite">
                <CurrencyInput
                  value={cardLimit}
                  onValueChange={setCardLimit}
                  required
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Fechamento (dia)">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={cardClosing}
                  onChange={(e) => setCardClosing(Number(e.target.value))}
                />
              </Field>
              <Field label="Vencimento (dia)">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={cardDue}
                  onChange={(e) => setCardDue(Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCardModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Salvar
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Modal Nova Categoria */}
      {categoryModalOpen ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setCategoryModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateConfigEntity(
                {
                  entity: "category",
                  context: fixedContext,
                  kind: catKind,
                  name: catName,
                  parentId: catParentId || null,
                  monthlyLimit: catLimit ? Number(catLimit) : null,
                },
                () => {
                  setCategoryModalOpen(false);
                  setCatName("");
                }
              );
            }}
            className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/80 rounded-t-[28px] md:rounded-[26px] p-5 space-y-3 overflow-y-auto shadow-2xl"
          >
            <h3 className="font-display text-base font-semibold">
              Nova categoria
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Tipo">
                <Select
                  value={catKind}
                  onChange={(e) =>
                    setCatKind(e.target.value as "INCOME" | "EXPENSE")
                  }
                >
                  <option value="EXPENSE">Saída / Gasto</option>
                  <option value="INCOME">Entrada / Receita</option>
                </Select>
              </Field>
              <Field label="Limite mensal">
                <CurrencyInput
                  value={catLimit}
                  onValueChange={setCatLimit}
                />
              </Field>
            </div>
            <Field label="Nome da categoria">
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                required
              />
            </Field>
            <Field label="Categoria pai (opcional)">
              <Select
                value={catParentId}
                onChange={(e) => setCatParentId(e.target.value)}
              >
                <option value="">Principal</option>
                {initialCategories
                  .filter((c) => !c.parentId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCategoryModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Salvar
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Modal Nova Meta */}
      {goalModalOpen ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setGoalModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateConfigEntity(
                {
                  entity: "goal",
                  context: fixedContext,
                  name: goalName,
                  targetAmount: Number(goalTarget),
                  currentAmount: Number(goalCurrent || 0),
                  targetDate: goalDate || undefined,
                },
                () => {
                  setGoalModalOpen(false);
                  setGoalName("");
                }
              );
            }}
            className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/80 rounded-t-[28px] md:rounded-[26px] p-5 space-y-3 overflow-y-auto shadow-2xl"
          >
            <h3 className="font-display text-base font-semibold">
              Nova meta
            </h3>
            <Field label="Nome da meta">
              <Input
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder={
                  isStudio
                    ? "Ex: Reforma ou Novo equipamento"
                    : "Ex: Reserva pessoal ou Viagem"
                }
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Objetivo">
                <CurrencyInput
                  value={goalTarget}
                  onValueChange={setGoalTarget}
                  required
                />
              </Field>
              <Field label="Atual">
                <CurrencyInput
                  value={goalCurrent}
                  onValueChange={setGoalCurrent}
                />
              </Field>
            </div>
            <Field label="Prazo (opcional)">
              <IosDatePicker value={goalDate} onChange={setGoalDate} />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setGoalModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Criar meta
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(deleteTxId)}
        title="Excluir lançamento?"
        description="Se este lançamento já tiver sido pago ou recebido, o saldo da conta vinculada será ajustado."
        confirmLabel="Excluir"
        loading={saving}
        onConfirm={handleDeleteTx}
        onCancel={() => setDeleteTxId(null)}
      />

      {/* Modal Selecionar Período (Dia específico, Mês, Personalizado ou Tudo) */}
      {periodModalOpen ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPeriodModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <div className="w-full max-h-[88dvh] md:max-w-sm bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/80 rounded-t-[28px] md:rounded-[26px] p-5 space-y-3.5 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">
                Filtrar período
              </h3>
              <button
                type="button"
                onClick={() => setPeriodModalOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] p-1 grid grid-cols-4 gap-1">
              {(
                [
                  ["DAY", "Dia"],
                  ["MONTH", "Mês"],
                  ["CUSTOM", "Personal."],
                  ["ALL", "Tudo"],
                ] as const
              ).map(([mKey, mLabel]) => (
                <button
                  key={mKey}
                  type="button"
                  onClick={() => setPeriodMode(mKey)}
                  className={`h-8 rounded-full text-[11px] font-medium cursor-pointer transition-all ${
                    periodMode === mKey
                      ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  {mLabel}
                </button>
              ))}
            </div>

            {periodMode === "DAY" ? (
              <div className="space-y-2">
                <Field label="Escolha o dia específico">
                  <IosDatePicker value={dayFilter} onChange={setDayFilter} />
                </Field>
                <button
                  type="button"
                  onClick={() => setDayFilter(todayStr)}
                  className="text-xs font-semibold text-[var(--brand-champagne)] cursor-pointer"
                >
                  Ir para hoje ({formatDateBR(todayStr)})
                </button>
              </div>
            ) : null}

            {periodMode === "MONTH" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)]">
                  <button
                    type="button"
                    onClick={() => setMonthFilter(shiftMonth(monthFilter, -1))}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-semibold capitalize">
                    {formatMonthLabelPT(monthFilter)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMonthFilter(shiftMonth(monthFilter, 1))}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Grade rápida para escolher qualquer dia específico dentro do mês */}
                <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] p-3 space-y-2">
                  <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                    Ou toque em um dia do mês para filtrar:
                  </p>
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[var(--text-muted)]">
                    {["D", "S", "T", "Q", "Q", "S", "S"].map((lbl, idx) => (
                      <span key={idx}>{lbl}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {monthCalendarCells.map((cell, idx) => {
                      if (!cell) {
                        return <div key={`empty-${idx}`} className="h-8" />;
                      }
                      const hasTx = (txMarkedDates.get(cell.dateKey) || 0) > 0;
                      const isToday = cell.dateKey === todayStr;
                      return (
                        <button
                          key={cell.dateKey}
                          type="button"
                          onClick={() => {
                            setDayFilter(cell.dateKey);
                            setPeriodMode("DAY");
                            setPeriodModalOpen(false);
                          }}
                          className={`relative h-8 rounded-lg text-xs font-medium tabular-nums flex items-center justify-center transition-colors cursor-pointer ${
                            isToday
                              ? "border border-[var(--brand-champagne)] text-[var(--brand-champagne)] font-semibold"
                              : "hover:bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                          }`}
                        >
                          <span>{cell.dayNum}</span>
                          {hasTx ? (
                            <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[var(--status-danger)]" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {periodMode === "CUSTOM" ? (
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="De">
                  <IosDatePicker value={customFrom} onChange={setCustomFrom} />
                </Field>
                <Field label="Até">
                  <IosDatePicker value={customTo} onChange={setCustomTo} />
                </Field>
              </div>
            ) : null}

            {periodMode === "ALL" ? (
              <p className="text-xs text-[var(--text-secondary)] py-2">
                Exibindo todo o histórico de lançamentos registrados.
              </p>
            ) : null}

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                size="sm"
                onClick={() => setPeriodModalOpen(false)}
              >
                Aplicar filtro
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* MODAL FECHAMENTO DE CAIXA */}
      {closingModalOpen && isStudio ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setClosingModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
        >
          <form
            onSubmit={handleCreateCashClosing}
            className="w-full max-h-[90dvh] md:max-w-lg bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/80 rounded-t-[28px] md:rounded-[26px] p-5 space-y-4 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold">
                  Fechamento de Caixa
                </h3>
                <p className="text-[11px] text-[var(--brand-champagne)] font-medium mt-0.5">
                  Período: {periodLabel}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar modal"
                onClick={() => setClosingModalOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error ? (
              <div className="p-2.5 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
                {error}
              </div>
            ) : null}

            {/* Resumo financeiro do período */}
            <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">
                  Faturamento bruto (Entrou)
                </span>
                <span className="font-semibold tabular-nums text-[var(--status-success)]">
                  {formatBRL(metrics.settledIn, hideValues)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-[var(--text-secondary)] pl-2">
                <span>Pix: {formatBRL(metrics.pixIn, hideValues)}</span>
                <span>Cartão: {formatBRL(metrics.cardIn, hideValues)}</span>
                <span>Dinheiro: {formatBRL(metrics.cashIn, hideValues)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Saídas pagas</span>
                <span className="font-semibold tabular-nums text-[var(--status-danger)]">
                  − {formatBRL(metrics.settledOut, hideValues)}
                </span>
              </div>
              <div className="flex justify-between border-t border-[var(--border-default)] pt-2">
                <span className="font-semibold text-[var(--text-primary)]">
                  Resultado líquido do caixa
                </span>
                <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                  {formatBRL(metrics.netResult, hideValues)}
                </span>
              </div>
            </div>

            {/* Porcentagem de comissão */}
            {(() => {
              const commissionAmount =
                Math.round(metrics.settledIn * parsedCommissionPct) / 100;
              const studioShareAmount =
                Math.round((metrics.settledIn - commissionAmount) * 100) / 100;
              return (
                <div className="rounded-2xl border border-[var(--brand-champagne)]/35 bg-[var(--brand-champagne-subtle)]/25 p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                        Comissão sobre faturamento
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Defina a porcentagem desejada
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 h-9 text-xs">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={commissionPctInput}
                        onChange={(e) => setCommissionPctInput(e.target.value)}
                        className="w-14 bg-transparent text-right font-semibold text-[var(--text-primary)] focus:outline-none tabular-nums text-base md:text-sm"
                      />
                      <span className="font-semibold text-[var(--brand-champagne)]">
                        %
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] px-3 py-2">
                      <p className="text-[10px] uppercase text-[var(--brand-champagne)]">
                        Comissão ({parsedCommissionPct}%)
                      </p>
                      <p className="text-sm font-semibold tabular-nums mt-0.5">
                        {formatBRL(commissionAmount, hideValues)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] px-3 py-2">
                      <p className="text-[10px] uppercase text-[var(--text-secondary)]">
                        Parte do estúdio
                      </p>
                      <p className="text-sm font-semibold tabular-nums mt-0.5">
                        {formatBRL(studioShareAmount, hideValues)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <Field label="Dinheiro contado na gaveta (opcional)">
              <CurrencyInput
                value={closingCountedCash}
                onValueChange={setClosingCountedCash}
              />
            </Field>

            {closingCountedCash.trim() !== "" ? (
              <p className="text-[11px] text-[var(--text-secondary)] -mt-2 tabular-nums">
                Diferença em relação ao dinheiro registrado:{" "}
                <strong className="text-[var(--text-primary)]">
                  {formatBRL(
                    Number(closingCountedCash || 0) - metrics.cashIn,
                    hideValues
                  )}
                </strong>
              </p>
            ) : null}

            {isOwner &&
            studioTransferAccounts.length > 0 &&
            personalTransferAccounts.length > 0 &&
            metrics.settledIn > 0 &&
            parsedCommissionPct > 0 ? (
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-canvas)] p-3 space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={closingTransferEnabled}
                    onChange={(e) =>
                      setClosingTransferEnabled(e.target.checked)
                    }
                    className="h-4 w-4 accent-[var(--brand-champagne)] rounded"
                  />
                  <span>
                    Transferir comissão para minha Conta Pessoal ao fechar
                  </span>
                </label>

                {closingTransferEnabled ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <Field label="Saindo de (Estúdio)">
                      <Select
                        value={closingFromAccount}
                        onChange={(e) => setClosingFromAccount(e.target.value)}
                      >
                        {studioTransferAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Entrando em (Pessoal)">
                      <Select
                        value={closingToAccount}
                        onChange={(e) => setClosingToAccount(e.target.value)}
                      >
                        {personalTransferAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                ) : null}
              </div>
            ) : null}

            <Field label="Observações do fechamento (opcional)">
              <Textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                rows={2}
                placeholder="Ex: Caixa conferido sem pendências..."
              />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setClosingModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Confirmar fechamento
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(deleteClosingId)}
        title="Excluir fechamento de caixa"
        description="Tem certeza que deseja excluir este registro de fechamento de caixa?"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        danger
        loading={saving}
        onConfirm={handleDeleteClosing}
        onCancel={() => !saving && setDeleteClosingId(null)}
      />
    </div>
  );
}

export function FinanceClient(props: {
  fixedContext: "STUDIO" | "PERSONAL";
  isOwner: boolean;
  hideValues: boolean;
  todayStr: string;
  currentMonth: string;
  initialAccounts: AccountItem[];
  transferAccounts: TransferAccountItem[];
  initialCards: CardItem[];
  initialCategories: CategoryItem[];
  initialTransactions: TxItem[];
  initialTransfers: TransferItem[];
  initialGoals: GoalItem[];
  projects: Array<{ id: string; name: string }>;
  studioAppointments?: StudioAppointmentItem[];
  initialCommissionPercent?: number;
  initialClosings?: CashClosingItem[];
}) {
  return (
    <Suspense
      fallback={
        <div className="text-xs text-[var(--text-secondary)]">
          Carregando financeiro...
        </div>
      }
    >
      <FinanceInner {...props} />
    </Suspense>
  );
}
