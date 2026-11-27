"use client";

import React, { Suspense, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  History,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import {
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
  formatPhoneBR,
  formatTimeBR,
} from "@/lib/format";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  PAYMENT_METHOD_LABELS,
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
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

type AppointmentItem = {
  id: string;
  clientId: string;
  clientName: string;
  clientWhatsapp: string;
  projectId: string | null;
  projectName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  serviceCategory: string | null;
  preferredPaymentMethod: string | null;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  bufferAfterMinutes: number;
  status: string;
  sessionNumber: number;
  totalSessions: number;
  recurrenceGroupId: string | null;
  priceEstimate: number | null;
  depositRequired: number | null;
  hasPendingPayment: boolean;
  paidAmount: number;
  clientNotes: string | null;
  internalNotes: string | null;
  history: Array<{
    id: string;
    previousStatus: string | null;
    newStatus: string;
    reason: string | null;
    createdAt: string;
  }>;
};

type BlockItem = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  blockType: string;
  reason: string | null;
};

type RuleItem = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotStepMinutes: number;
  bufferMinutes: number;
  isActive: boolean;
};

type ServiceItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  sessionsCount: number;
  price: number;
  depositAmount: number;
  isActive: boolean;
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_FULL = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function toSPDateKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDaysISO(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + delta);
  return toSPDateKey(d.toISOString());
}

function parseHMToMinutes(hm: string, fallback = 0): number {
  const m = /^(\d{2}):(\d{2})$/.exec(hm.trim());
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return fallback;
  return h * 60 + min;
}

function addMinutesToHM(hm: string, deltaMinutes: number): string {
  const base = parseHMToMinutes(hm, 10 * 60);
  const wrapped = (((base + Math.round(deltaMinutes)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function diffMinutesBetweenHM(startHM: string, endHM: string): number {
  const s = parseHMToMinutes(startHM, -1);
  const e = parseHMToMinutes(endHM, -1);
  if (s < 0 || e < 0 || s === e) return 0;
  return e > s ? e - s : e + 1440 - s;
}

function formatDurationLabel(mins: number): string {
  if (mins <= 0) return "Horário inválido";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")} (${mins} min)`;
}

function formatDayHeadlineBR(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "short",
  }).format(new Date(`${dateStr}T12:00:00-03:00`));
}

function formatWhatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}`;
}

function getNextQuickStatus(status: string): {
  nextStatus: "CONFIRMED" | "IN_PROGRESS" | "COMPLETED";
  label: string;
} | null {
  if (
    status === "REQUESTED" ||
    status === "AWAITING_CONFIRMATION" ||
    status === "AWAITING_DEPOSIT"
  ) {
    return { nextStatus: "CONFIRMED", label: "Confirmar" };
  }
  if (status === "CONFIRMED") {
    return { nextStatus: "IN_PROGRESS", label: "Iniciar" };
  }
  if (status === "IN_PROGRESS") {
    return { nextStatus: "COMPLETED", label: "Concluir" };
  }
  return null;
}

/**
 * Card arrastável para a esquerda estilo iOS revelando o botão Excluir atrás.
 */
function SwipeableAppointmentCard({
  onOpen,
  onDelete,
  roundedClass = "rounded-xl",
  children,
}: {
  onOpen: () => void;
  onDelete: () => void;
  roundedClass?: string;
  children: React.ReactNode;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    baseOffset: 0,
    moved: false,
  });

  const ACTION_WIDTH = 84;
  const revealAction = dragging || offsetX < -2;

  return (
    <div className={`relative overflow-hidden bg-[var(--bg-surface)] ${roundedClass}`}>
      {/* Ação Excluir por trás (só aparece ao arrastar para o lado) */}
      <div
        aria-hidden={!revealAction}
        className={`absolute inset-y-0 right-0 w-[84px] flex items-stretch transition-opacity duration-150 ${
          revealAction ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOffsetX(0);
            onDelete();
          }}
          className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white flex flex-col items-center justify-center gap-1 text-[11px] font-semibold cursor-pointer"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.8} />
          <span>Excluir</span>
        </button>
      </div>

      {/* Card arrastável na frente */}
      <div
        role="button"
        tabIndex={0}
        onPointerDown={(e) => {
          const target = e.target as HTMLElement | null;
          if (
            target?.closest("a, button") ||
            (e.pointerType === "mouse" && e.button !== 0)
          ) {
            return;
          }
          dragRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            baseOffset: offsetX,
            moved: false,
          };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.active) return;
          const dx = e.clientX - dragRef.current.startX;
          const dy = e.clientY - dragRef.current.startY;
          if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 12) return;
          if (Math.abs(dx) > 6) dragRef.current.moved = true;
          const next = Math.max(
            -ACTION_WIDTH - 12,
            Math.min(0, dragRef.current.baseOffset + dx)
          );
          setOffsetX(next);
        }}
        onPointerUp={() => {
          if (!dragRef.current.active) return;
          dragRef.current.active = false;
          setDragging(false);
          setOffsetX((curr) => (curr <= -40 ? -ACTION_WIDTH : 0));
        }}
        onPointerCancel={() => {
          dragRef.current.active = false;
          setDragging(false);
          setOffsetX(0);
        }}
        onClick={() => {
          if (dragRef.current.moved) {
            dragRef.current.moved = false;
            return;
          }
          if (offsetX !== 0) {
            setOffsetX(0);
            return;
          }
          onOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        style={{
          transform: `translate3d(${offsetX}px, 0, 0)`,
          transition: dragging
            ? "none"
            : "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
          touchAction: "pan-y",
        }}
        className="relative z-10 w-full cursor-pointer select-none bg-[var(--bg-surface)]"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Faixa horizontal arrastável com o mouse ou dedo (carrossel estilo iOS).
 */
function HorizontalDragRail({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({
    active: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });

  return (
    <div
      ref={scrollRef}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse" || e.button !== 0 || !scrollRef.current)
          return;
        dragState.current = {
          active: true,
          startX: e.clientX,
          scrollLeft: scrollRef.current.scrollLeft,
          moved: false,
        };
      }}
      onPointerMove={(e) => {
        if (!dragState.current.active || !scrollRef.current) return;
        const dx = e.clientX - dragState.current.startX;
        if (Math.abs(dx) > 5) dragState.current.moved = true;
        scrollRef.current.scrollLeft = dragState.current.scrollLeft - dx;
      }}
      onPointerUp={() => {
        dragState.current.active = false;
      }}
      onPointerCancel={() => {
        dragState.current.active = false;
      }}
      onPointerLeave={() => {
        dragState.current.active = false;
      }}
      onClickCapture={(e) => {
        if (dragState.current.moved) {
          e.preventDefault();
          e.stopPropagation();
          dragState.current.moved = false;
        }
      }}
      className={className}
    >
      {children}
    </div>
  );
}

function IosModalShell({
  onClose,
  maxWidthClass = "max-w-lg",
  dragOffsetX = 0,
  isDragging = false,
  swipeHandlers,
  children,
}: {
  onClose: () => void;
  maxWidthClass?: string;
  dragOffsetX?: number;
  isDragging?: boolean;
  swipeHandlers?: React.HTMLAttributes<HTMLDivElement>;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-5"
    >
      <div
        {...swipeHandlers}
        style={{
          transform:
            dragOffsetX !== 0
              ? `translate3d(${dragOffsetX}px, 0, 0) rotate(${dragOffsetX * 0.012}deg)`
              : undefined,
          transition: isDragging
            ? "none"
            : "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
          touchAction: "pan-y",
        }}
        className={`w-full ${maxWidthClass} max-h-[88dvh] bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/80 rounded-t-[28px] md:rounded-[26px] shadow-[0_24px_70px_rgba(0,0,0,0.65)] overflow-y-auto pb-5 md:pb-2`}
      >
        <div className="pt-2.5 pb-0.5 flex justify-center">
          <span className="h-1 w-9 rounded-full bg-[var(--border-strong)]" />
        </div>
        {children}
      </div>
    </div>
  );
}

function AgendaInner({
  initialDate,
  initialAppointments,
  initialBlocks,
  initialRules,
  clients,
  projects,
  initialServices,
}: {
  initialDate: string;
  initialAppointments: AppointmentItem[];
  initialBlocks: BlockItem[];
  initialRules: RuleItem[];
  clients: Array<{ id: string; fullName: string; whatsapp: string }>;
  projects: Array<{ id: string; name: string; clientId: string }>;
  initialServices: ServiceItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"day" | "month" | "list">("list");
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [rules, setRules] = useState(initialRules);
  const [services, setServices] = useState(initialServices);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [createOpen, setCreateOpen] = useState(
    searchParams.get("novo") === "1"
  );
  const [blocksOpen, setBlocksOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [deleteApptTarget, setDeleteApptTarget] =
    useState<AppointmentItem | null>(null);

  // Modal de detalhes arrastável para o lado
  const [detailAppt, setDetailAppt] = useState<AppointmentItem | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "edit" | "history">(
    "info"
  );
  const [modalDragX, setModalDragX] = useState(0);
  const [modalDragging, setModalDragging] = useState(false);
  const modalSwipeStart = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  // Cadastro rápido de Serviço e Categoria
  const [svcCategory, setSvcCategory] = useState("Fine Line");
  const [svcName, setSvcName] = useState("");
  const [svcDuration, setSvcDuration] = useState(120);
  const [svcPrice, setSvcPrice] = useState("");
  const [svcDeposit, setSvcDeposit] = useState("");
  const [svcDescription, setSvcDescription] = useState("");
  const [svcError, setSvcError] = useState<string | null>(null);

  // Formulário de novo agendamento
  const [clientList, setClientList] = useState(clients);
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [addingClientInline, setAddingClientInline] = useState(
    clients.length === 0
  );
  const [quickClientName, setQuickClientName] = useState("");
  const [quickClientWhatsapp, setQuickClientWhatsapp] = useState("");
  const [quickClientEmail, setQuickClientEmail] = useState("");
  const [savingQuickClient, setSavingQuickClient] = useState(false);
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);

  const [projectId, setProjectId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [formSessionNumber, setFormSessionNumber] = useState(1);
  const [formTotalSessions, setFormTotalSessions] = useState(1);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(0);
  const [status, setStatus] = useState("CONFIRMED");
  const [priceEstimate, setPriceEstimate] = useState("");
  const [depositRequired, setDepositRequired] = useState("");
  const [recurrenceCount, setRecurrenceCount] = useState(1);
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState(30);
  const [internalNotes, setInternalNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Bloqueio rápido
  const [blockTitle, setBlockTitle] = useState("");
  const [blockStartDate, setBlockStartDate] = useState(initialDate);
  const [blockStartTime, setBlockStartTime] = useState("12:00");
  const [blockEndDate, setBlockEndDate] = useState(initialDate);
  const [blockEndTime, setBlockEndTime] = useState("13:30");

  // Edição/Reagendamento no detalhe
  const [editStatus, setEditStatus] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editInternalNotes, setEditInternalNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [detailError, setDetailError] = useState<string | null>(null);

  const clientProjects = useMemo(
    () => projects.filter((p) => p.clientId === clientId),
    [projects, clientId]
  );

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) =>
      statusFilter === "ALL" ? true : a.status === statusFilter
    );
  }, [appointments, statusFilter]);

  const dayAppointments = useMemo(
    () =>
      filteredAppointments.filter(
        (a) => toSPDateKey(a.startAt) === selectedDate
      ),
    [filteredAppointments, selectedDate]
  );

  // Lista usada para arrastar entre cards dentro do modal de detalhe
  const navigableAppointments = useMemo(() => {
    if (view === "day" && dayAppointments.length > 0) return dayAppointments;
    return filteredAppointments;
  }, [view, dayAppointments, filteredAppointments]);

  const currentDetailIndex = useMemo(() => {
    if (!detailAppt) return -1;
    return navigableAppointments.findIndex((a) => a.id === detailAppt.id);
  }, [detailAppt, navigableAppointments]);

  const stripDates = useMemo(
    () => Array.from({ length: 15 }, (_, idx) => addDaysISO(selectedDate, idx - 3)),
    [selectedDate]
  );

  const monthGrid = useMemo(() => {
    const [y, m] = selectedDate.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const startOffset = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: Array<{ dateKey: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ dateKey: null, dayNum: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}`;
      cells.push({ dateKey, dayNum: day });
    }
    return cells;
  }, [selectedDate]);

  const appointmentsCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appt of filteredAppointments) {
      const key = toSPDateKey(appt.startAt);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [filteredAppointments]);

  const pendingNextSessions = useMemo(() => {
    return appointments.filter((a) => {
      if (a.status !== "COMPLETED" || a.sessionNumber >= a.totalSessions) {
        return false;
      }
      const hasNext = appointments.some(
        (other) =>
          other.id !== a.id &&
          other.clientId === a.clientId &&
          other.status !== "CANCELLED" &&
          other.status !== "NO_SHOW" &&
          other.sessionNumber > a.sessionNumber &&
          ((a.serviceId && other.serviceId === a.serviceId) ||
            (a.recurrenceGroupId && other.recurrenceGroupId === a.recurrenceGroupId) ||
            other.title === a.title)
      );
      return !hasNext;
    });
  }, [appointments]);

  const openNextSessionModal = (appt: AppointmentItem) => {
    const nextSession = appt.sessionNumber + 1;
    setAddingClientInline(false);
    setClientId(appt.clientId);
    setProjectId(appt.projectId || "");
    setSelectedServiceId(appt.serviceId || "");
    setFormSessionNumber(nextSession);
    setFormTotalSessions(appt.totalSessions);
    const cleanBase = appt.title.replace(/\s*\(Sessão\s*\d+(?:\/\d+)?\)\s*$/i, "").trim();
    setTitle(`${cleanBase} (Sessão ${nextSession})`);
    setDurationMinutes(appt.durationMinutes);
    setEndTime(addMinutesToHM(startTime, appt.durationMinutes));
    setPriceEstimate(appt.priceEstimate ? appt.priceEstimate.toFixed(2) : "");
    setDepositRequired("");
    setDate(selectedDate);
    setDetailAppt(null);
    setCreateOpen(true);
  };

  // Agenda do admin sempre em grade 24h (00:00 às 23:30 em slots de 30 min);
  // regras de horário de atendimento valem apenas para a agenda pública.
  const timelineSlots = useMemo(() => {
    const weekday = new Date(`${selectedDate}T12:00:00-03:00`).getUTCDay();
    const rule = rules.find((r) => r.dayOfWeek === weekday);

    const startMin = 0;
    const endMin = 24 * 60;
    const step = 30;
    const dayStartMs = new Date(`${selectedDate}T00:00:00-03:00`).getTime();
    const dayEndMs = dayStartMs + 24 * 60 * 60_000;

    const activeDayAppts = filteredAppointments.filter((a) => {
      if (a.status === "CANCELLED" || a.status === "NO_SHOW") return false;
      const aStart = new Date(a.startAt).getTime();
      const aEnd = new Date(a.endAt).getTime();
      return aStart < dayEndMs && aEnd > dayStartMs;
    });

    const slots: Array<
      | { time: string; kind: "appointment"; appt: AppointmentItem }
      | { time: string; kind: "occupied" }
      | { time: string; kind: "blocked"; label: string }
      | { time: string; kind: "free" }
    > = [];

    const placedApptIds = new Set<string>();

    for (let min = startMin; min < endMin; min += step) {
      const hh = String(Math.floor(min / 60)).padStart(2, "0");
      const mm = String(min % 60).padStart(2, "0");
      const timeLabel = `${hh}:${mm}`;
      const slotStartMs = dayStartMs + min * 60_000;
      const slotEndMs = slotStartMs + step * 60_000;

      const starting = activeDayAppts.find((a) => {
        if (placedApptIds.has(a.id)) return false;
        const aStart = new Date(a.startAt).getTime();
        return aStart >= slotStartMs && aStart < slotEndMs;
      });

      if (starting) {
        placedApptIds.add(starting.id);
        slots.push({ time: timeLabel, kind: "appointment", appt: starting });
        continue;
      }

      const covering = activeDayAppts.find((a) => {
        const aStart = new Date(a.startAt).getTime();
        const aEnd = new Date(a.endAt).getTime();
        return aStart < slotEndMs && aEnd > slotStartMs;
      });

      if (covering) {
        slots.push({ time: timeLabel, kind: "occupied" });
        continue;
      }

      const blocking = blocks.find((b) => {
        const bStart = new Date(b.startAt).getTime();
        const bEnd = new Date(b.endAt).getTime();
        return bStart < slotEndMs && bEnd > slotStartMs;
      });

      if (blocking) {
        slots.push({ time: timeLabel, kind: "blocked", label: blocking.title });
        continue;
      }

      slots.push({ time: timeLabel, kind: "free" });
    }

    return {
      isDayClosed: Boolean(rule && !rule.isActive),
      slots,
    };
  }, [selectedDate, rules, filteredAppointments, blocks]);

  const refreshAgenda = async () => {
    const res = await fetch("/api/admin/appointments");
    if (res.ok) {
      const data = await res.json();
      setAppointments(
        data.appointments.map(
          (
            a: AppointmentItem & {
              client: { fullName: string; whatsapp: string };
              project?: { name: string } | null;
              service?: { id: string; name: string; category: string; sessionsCount?: number } | null;
              payments: Array<{ amount: unknown; status: string }>;
            }
          ) => {
            const paidAmount = a.payments
              .filter((p) => p.status === "CONFIRMED")
              .reduce((acc, p) => acc + Number(p.amount || 0), 0);
            const est = Number(a.priceEstimate || 0);
            return {
              ...a,
              clientName: a.client.fullName,
              clientWhatsapp: a.client.whatsapp,
              projectName: a.project?.name || null,
              serviceId: a.serviceId || a.service?.id || null,
              serviceName: a.service?.name || null,
              serviceCategory: a.service?.category || null,
              totalSessions: Math.max(
                a.totalSessions || 1,
                a.service?.sessionsCount || 1
              ),
              priceEstimate:
                a.priceEstimate !== null ? Number(a.priceEstimate) : null,
              depositRequired:
                a.depositRequired !== null ? Number(a.depositRequired) : null,
              paidAmount,
              hasPendingPayment: est > 0 && paidAmount < est,
            };
          }
        )
      );
      setBlocks(data.blocks);
      setRules(data.rules);
      router.refresh();
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSvcError(null);
    try {
      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: svcCategory,
          name: svcName,
          durationMinutes: Number(svcDuration || 120),
          price: Number(svcPrice || 0),
          depositAmount: Number(svcDeposit || 0),
          description: svcDescription || null,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSvcError(data.error || "Erro ao cadastrar serviço.");
        return;
      }
      setServices((prev) => [...prev, data.service]);
      setSvcName("");
      setSvcPrice("");
      setSvcDeposit("");
      setSvcDescription("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const toggleServiceActive = async (svc: ServiceItem) => {
    const res = await fetch(`/api/admin/services/${svc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !svc.isActive }),
    });
    if (res.ok) {
      const data = await res.json();
      setServices((prev) =>
        prev.map((s) => (s.id === svc.id ? data.service : s))
      );
      router.refresh();
    }
  };

  const deleteService = async (id: string) => {
    const res = await fetch(`/api/admin/services/${id}`, { method: "DELETE" });
    if (res.ok) {
      setServices((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    }
  };

  const createQuickClient = async (): Promise<string | null> => {
    const cleanName = quickClientName.trim();
    const cleanWhatsapp = quickClientWhatsapp.trim();
    if (cleanName.length < 3) {
      setFormError("Informe o nome completo da cliente (mín. 3 letras).");
      return null;
    }
    if (cleanWhatsapp.replace(/\D/g, "").length < 8) {
      setFormError("Informe um WhatsApp válido com DDD.");
      return null;
    }

    setSavingQuickClient(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: cleanName,
          whatsapp: cleanWhatsapp,
          phone: cleanWhatsapp,
          email: quickClientEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Não foi possível cadastrar a cliente.");
        return null;
      }
      const created = {
        id: data.client.id as string,
        fullName: data.client.fullName as string,
        whatsapp: data.client.whatsapp as string,
      };
      setClientList((prev) => [created, ...prev]);
      setClientId(created.id);
      setProjectId("");
      setQuickClientName("");
      setQuickClientWhatsapp("");
      setQuickClientEmail("");
      setAddingClientInline(false);
      return created.id;
    } finally {
      setSavingQuickClient(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      let targetClientId = clientId;
      if (addingClientInline || !targetClientId) {
        const createdId = await createQuickClient();
        if (!createdId) {
          setSaving(false);
          return;
        }
        targetClientId = createdId;
      }

      const computedDuration = diffMinutesBetweenHM(startTime, endTime);
      if (computedDuration < 15 || computedDuration > 720) {
        setFormError(
          "Informe um horário de término após o início (entre 15 min e 12 horas)."
        );
        setSaving(false);
        return;
      }

      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: targetClientId,
          projectId: projectId || null,
          serviceId: selectedServiceId || null,
          sessionNumber: Number(formSessionNumber) || 1,
          totalSessions: Number(formTotalSessions) || 1,
          title,
          date,
          startTime,
          durationMinutes: computedDuration,
          bufferAfterMinutes: Number(bufferAfterMinutes),
          status,
          priceEstimate: priceEstimate ? Number(priceEstimate) : null,
          depositRequired: depositRequired ? Number(depositRequired) : null,
          recurrenceCount: Number(recurrenceCount),
          recurrenceIntervalDays: Number(recurrenceIntervalDays),
          internalNotes: internalNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Não foi possível agendar.");
        setSaving(false);
        return;
      }
      setCreateOpen(false);
      setTitle("");
      setSelectedServiceId("");
      setFormSessionNumber(1);
      setFormTotalSessions(1);
      setInternalNotes("");
      await refreshAgenda();
    } finally {
      setSaving(false);
    }
  };

  const openDetail = (
    appt: AppointmentItem,
    tab: "info" | "edit" | "history" = "info"
  ) => {
    setDetailAppt(appt);
    setDetailTab(tab);
    setEditStatus(appt.status);
    setEditDate(toSPDateKey(appt.startAt));
    setEditTime(formatTimeBR(appt.startAt));
    setEditEndTime(formatTimeBR(appt.endAt));
    setEditInternalNotes(appt.internalNotes || "");
    setEditReason("");
    setDetailError(null);
    setModalDragX(0);
  };

  const navigateDetailBy = (delta: number) => {
    if (currentDetailIndex < 0) return;
    const target = navigableAppointments[currentDetailIndex + delta];
    if (target) {
      openDetail(target, "info");
    }
  };

  const detailSwipeHandlers: React.HTMLAttributes<HTMLDivElement> = {
    onPointerDown: (e) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, button, a, label") ||
        (e.pointerType === "mouse" && e.button !== 0)
      ) {
        return;
      }
      modalSwipeStart.current = { x: e.clientX, y: e.clientY, active: true };
      setModalDragging(true);
    },
    onPointerMove: (e) => {
      if (!modalSwipeStart.current.active) return;
      const dx = e.clientX - modalSwipeStart.current.x;
      const dy = e.clientY - modalSwipeStart.current.y;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 16) return;
      setModalDragX(Math.max(-180, Math.min(180, dx)));
    },
    onPointerUp: () => {
      if (!modalSwipeStart.current.active) return;
      modalSwipeStart.current.active = false;
      setModalDragging(false);

      if (modalDragX <= -65) {
        if (currentDetailIndex < navigableAppointments.length - 1) {
          navigateDetailBy(1);
        } else if (navigableAppointments.length <= 1) {
          setDetailAppt(null);
        }
      } else if (modalDragX >= 65) {
        if (currentDetailIndex > 0) {
          navigateDetailBy(-1);
        } else if (navigableAppointments.length <= 1) {
          setDetailAppt(null);
        }
      }
      setModalDragX(0);
    },
    onPointerCancel: () => {
      modalSwipeStart.current.active = false;
      setModalDragging(false);
      setModalDragX(0);
    },
  };

  const handleQuickStatusFromDetail = async (nextStatus: string) => {
    if (!detailAppt) return;
    setSaving(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/admin/appointments/${detailAppt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error || "Não foi possível atualizar status.");
        return;
      }
      const updated = { ...detailAppt, status: nextStatus };
      setDetailAppt(updated);
      setEditStatus(nextStatus);
      await refreshAgenda();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAppt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailAppt) return;
    const nextDuration = diffMinutesBetweenHM(editTime, editEndTime);
    if (nextDuration < 15 || nextDuration > 720) {
      setDetailError(
        "O horário final deve ser após o início (entre 15 min e 12 horas)."
      );
      return;
    }

    setSaving(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/admin/appointments/${detailAppt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          date: editDate,
          startTime: editTime,
          durationMinutes: nextDuration,
          internalNotes: editInternalNotes || null,
          reason: editReason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error || "Falha ao atualizar atendimento.");
        setSaving(false);
        return;
      }
      setDetailAppt(null);
      await refreshAgenda();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: blockTitle,
          startDate: blockStartDate,
          startTime: blockStartTime,
          endDate: blockEndDate,
          endTime: blockEndTime,
        }),
      });
      if (res.ok) {
        setBlockTitle("");
        await refreshAgenda();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    await fetch(`/api/admin/availability?id=${id}`, { method: "DELETE" });
    await refreshAgenda();
  };

  const handleDeleteAppt = async () => {
    if (!deleteApptTarget) return;
    setSaving(true);
    setAgendaError(null);
    setDetailError(null);
    try {
      const res = await fetch(
        `/api/admin/appointments/${deleteApptTarget.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || "Não foi possível excluir o agendamento.";
        setAgendaError(msg);
        setDetailError(msg);
        setDeleteApptTarget(null);
        return;
      }
      const deletedId = deleteApptTarget.id;
      setAppointments((prev) => prev.filter((a) => a.id !== deletedId));
      if (detailAppt?.id === deletedId) {
        setDetailAppt(null);
      }
      setDeleteApptTarget(null);
      await refreshAgenda();
    } catch {
      const msg = "Erro de conexão ao excluir agendamento.";
      setAgendaError(msg);
      setDetailError(msg);
      setDeleteApptTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/admin/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      setRulesOpen(false);
      await refreshAgenda();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Topo fino estilo referência iOS */}
      <div className="flex items-center justify-between gap-2">
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-0.5 grid grid-cols-3 gap-0.5 flex-1 max-w-[210px]">
          {(
            [
              ["list", "Lista"],
              ["day", "Dia"],
              ["month", "Mês"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`h-8 px-2 rounded-[10px] text-[11px] font-medium transition-all cursor-pointer ${
                view === key
                  ? "bg-[var(--bg-subtle)] text-[var(--text-primary)] font-semibold"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <IosDatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            variant="icon"
            markedDates={appointmentsCountByDate}
            ariaLabel="Abrir calendário"
          />
          <button
            type="button"
            onClick={() => setToolsOpen(true)}
            aria-label="Configurar agenda, serviços e horários"
            className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
          >
            <Settings2 className="h-4 w-4" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => {
              setDate(selectedDate);
              setEndTime(addMinutesToHM(startTime, durationMinutes));
              setFormError(null);
              setCreateOpen(true);
            }}
            aria-label="Novo agendamento"
            className="h-9 px-3 inline-flex items-center gap-1 rounded-xl bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold hover:bg-[var(--action-primary-hover)] transition-all active:scale-[0.96] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            <span>Agendar</span>
          </button>
        </div>
      </div>

      {agendaError ? (
        <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs flex items-center justify-between gap-2">
          <span>{agendaError}</span>
          <button
            type="button"
            onClick={() => setAgendaError(null)}
            className="underline font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      ) : null}

      {/* Navegação fina da data centralizada (estilo referência) */}
      <div className="flex items-center justify-between px-1 py-0.5">
        <button
          type="button"
          onClick={() => setSelectedDate(addDaysISO(selectedDate, -1))}
          aria-label="Data anterior"
          className="h-8 w-8 inline-flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
        </button>

        <button
          type="button"
          onClick={() => setSelectedDate(initialDate)}
          className="text-center cursor-pointer group"
        >
          <p className="font-display text-sm font-semibold text-[var(--text-primary)] capitalize leading-tight">
            {selectedDate === initialDate
              ? "Hoje"
              : new Intl.DateTimeFormat("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  weekday: "long",
                }).format(new Date(`${selectedDate}T12:00:00-03:00`))}
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-[var(--text-secondary)]">
              {new Intl.DateTimeFormat("pt-BR", {
                timeZone: "America/Sao_Paulo",
                day: "2-digit",
                month: "long",
              }).format(new Date(`${selectedDate}T12:00:00-03:00`))}
            </span>
            {dayAppointments.length > 0 ? (
              <span className="h-4 min-w-4 px-1 inline-flex items-center justify-center rounded-full bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/40 text-[10px] font-semibold text-[var(--brand-champagne)] tabular-nums">
                {dayAppointments.length}
              </span>
            ) : null}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedDate(addDaysISO(selectedDate, 1))}
          aria-label="Próxima data"
          className="h-8 w-8 inline-flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>

      {/* Faixa de 15 dias apenas na visão Dia */}
      {view === "day" ? (
        <HorizontalDragRail className="flex items-center gap-1.5 overflow-x-auto snap-x cursor-grab active:cursor-grabbing pb-0.5 select-none">
          {stripDates.map((dKey) => {
            const dObj = new Date(`${dKey}T12:00:00-03:00`);
            const wd = WEEKDAYS[dObj.getUTCDay()];
            const dayNum = dKey.slice(8, 10);
            const active = dKey === selectedDate;
            const count = appointmentsCountByDate.get(dKey) || 0;

            return (
              <button
                key={dKey}
                type="button"
                onClick={() => setSelectedDate(dKey)}
                className={`snap-center min-w-[44px] py-1.5 px-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer shrink-0 ${
                  active
                    ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] shadow-sm"
                    : "bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="text-[10px] font-medium opacity-80">{wd}</span>
                <span className="text-xs font-semibold tabular-nums leading-tight">
                  {dayNum}
                </span>
                <span
                  className={`h-1 w-1 rounded-full mt-0.5 ${
                    count > 0 ? "bg-[var(--brand-champagne)]" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </HorizontalDragRail>
      ) : null}

      {pendingNextSessions.length > 0 ? (
        <div className="rounded-2xl border border-[var(--brand-champagne)]/40 bg-[var(--brand-champagne-subtle)] p-3 space-y-2">
          {pendingNextSessions.map((appt) => {
            const nextSession = appt.sessionNumber + 1;
            return (
              <div
                key={`next-${appt.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-primary)] truncate">
                    {appt.clientName} — Sessão {appt.sessionNumber}/{appt.totalSessions} concluída
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate">
                    Falta reagendar Sessão {nextSession}/{appt.totalSessions} ({appt.serviceName || appt.title})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openNextSessionModal(appt)}
                  className="h-8 px-3 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  Agendar Sessão {nextSession}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Visão Diária Estilo iOS */}
      {view === "day" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="font-display text-sm font-semibold text-[var(--text-primary)] capitalize">
                {formatDayHeadlineBR(selectedDate)}
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {dayAppointments.length === 0
                  ? "Nenhum atendimento marcado"
                  : `${dayAppointments.length} atendimento(s) • Arraste os cards e toque para abrir`}
              </p>
            </div>
          </div>

          {dayAppointments.length === 0 ? (
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-6">
              <EmptyState
                icon={<CalendarIcon className="h-5 w-5" strokeWidth={1.5} />}
                title="Dia livre"
                description="Nenhum agendamento registrado para esta data."
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setDate(selectedDate);
                      setEndTime(addMinutesToHM(startTime, durationMinutes));
                      setFormError(null);
                      setCreateOpen(true);
                    }}
                  >
                    Agendar neste dia
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              {dayAppointments.map((appt) => {
                const waHref = formatWhatsappHref(appt.clientWhatsapp);
                return (
                  <SwipeableAppointmentCard
                    key={appt.id}
                    roundedClass="rounded-[24px]"
                    onOpen={() => openDetail(appt, "info")}
                    onDelete={() => setDeleteApptTarget(appt)}
                  >
                    <div className="w-full rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-strong)]/80 p-5 space-y-4 shadow-sm hover:border-[var(--brand-champagne)]/60 transition-all">
                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/35">
                          <Clock
                            className="h-3.5 w-3.5 text-[var(--brand-champagne)]"
                            strokeWidth={2}
                          />
                          <span className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                            {formatTimeBR(appt.startAt)} –{" "}
                            {formatTimeBR(appt.endAt)}
                          </span>
                          <span className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                            • {appt.durationMinutes} min
                          </span>
                        </div>

                        <StatusBadge
                          label={
                            APPOINTMENT_STATUS_LABELS[appt.status] ||
                            appt.status
                          }
                          tone={
                            APPOINTMENT_STATUS_TONE[appt.status] || "neutral"
                          }
                        />
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-display text-lg font-semibold text-[var(--text-primary)] truncate">
                              {appt.clientName}
                            </p>
                            {appt.totalSessions > 1 ? (
                              <span className="px-2 py-0.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] text-[10px] font-semibold text-[var(--brand-champagne)] shrink-0">
                                Sessão {appt.sessionNumber}/{appt.totalSessions}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] truncate">
                            {appt.serviceName || appt.title}
                          </p>
                        </div>

                        {waHref ? (
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Abrir WhatsApp da cliente"
                            className="h-9 w-9 rounded-full bg-[var(--status-success-bg)] text-[var(--status-success)] inline-flex items-center justify-center shrink-0"
                          >
                            <WhatsAppIcon size={17} />
                          </a>
                        ) : null}
                      </div>

                      <div className="pt-3 flex items-center justify-between gap-2 border-t border-[var(--border-default)] text-xs">
                        <span className="tabular-nums font-semibold text-[var(--text-primary)]">
                          {appt.priceEstimate !== null
                            ? formatBRL(appt.priceEstimate)
                            : "Valor a definir"}
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-[var(--brand-champagne)]">
                          Ver detalhes
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </SwipeableAppointmentCard>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* Visão Mensal */}
      {view === "month" ? (
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[var(--border-default)] bg-[var(--bg-subtle)]">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-[11px] font-semibold text-[var(--text-secondary)]"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-[var(--border-default)]">
            {monthGrid.map((cell, idx) => {
              if (!cell.dateKey) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[68px] bg-[var(--bg-subtle)]/35"
                  />
                );
              }
              const count = appointmentsCountByDate.get(cell.dateKey) || 0;
              const isSelected = cell.dateKey === selectedDate;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => {
                    setSelectedDate(cell.dateKey!);
                    setView("day");
                  }}
                  className={`min-h-[68px] p-2 text-left flex flex-col justify-between hover:bg-[var(--bg-subtle)] cursor-pointer ${
                    isSelected ? "bg-[var(--brand-champagne-subtle)]" : ""
                  }`}
                >
                  <span className="text-xs font-semibold tabular-nums">
                    {cell.dayNum}
                  </span>
                  {count > 0 ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] w-fit tabular-nums">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Grade Cronológica de Horários do Dia (Estilo Lista de Referência) */}
      {view === "list" ? (
        <div className="space-y-3">
          {timelineSlots.isDayClosed ? (
            <div className="px-3.5 py-2 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)]">
              Dia fechado para clientes na agenda pública ({" "}
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="font-semibold text-[var(--brand-champagne)] underline cursor-pointer"
              >
                Horários
              </button>
              ). No painel admin a grade segue liberada 24h.
            </div>
          ) : null}

          <div className="space-y-1.5">
            {timelineSlots.slots.map((slot) => {
              if (slot.kind === "appointment") {
                const appt = slot.appt;
                const waHref = formatWhatsappHref(appt.clientWhatsapp);
                const borderAccent =
                  appt.status === "CONFIRMED" || appt.status === "COMPLETED"
                    ? "border-l-[var(--status-success)]"
                    : appt.status === "CANCELLED" || appt.status === "NO_SHOW"
                      ? "border-l-[var(--status-danger)]"
                      : appt.status === "IN_PROGRESS"
                        ? "border-l-[var(--brand-champagne)]"
                        : "border-l-[var(--status-warning)]";

                return (
                  <div key={`${slot.time}-${appt.id}`} className="flex items-start gap-2">
                    <span className="w-10 pt-2 text-[11px] font-medium tabular-nums text-[var(--text-secondary)] text-right shrink-0">
                      {slot.time}
                    </span>
                    <div className="flex-1 pl-2 border-l border-[var(--border-default)]/70">
                      <SwipeableAppointmentCard
                        onOpen={() => openDetail(appt, "info")}
                        onDelete={() => setDeleteApptTarget(appt)}
                      >
                        <div
                          className={`w-full text-left rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] border-l-2 ${borderAccent} px-3 py-2.5 space-y-1 hover:bg-[var(--bg-subtle)]/50 transition-colors`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[11px] font-semibold tabular-nums text-[var(--text-primary)]">
                                {formatTimeBR(appt.startAt)} –{" "}
                                {formatTimeBR(appt.endAt)}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)] tabular-nums">
                                {appt.durationMinutes}min
                              </span>
                            </div>
                            <StatusBadge
                              label={
                                APPOINTMENT_STATUS_LABELS[appt.status] ||
                                appt.status
                              }
                              tone={
                                APPOINTMENT_STATUS_TONE[appt.status] || "neutral"
                              }
                            />
                          </div>

                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {appt.clientName}
                            </p>
                            {waHref ? (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Abrir WhatsApp da cliente"
                                className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[var(--status-success-bg)] text-[var(--status-success)] shrink-0"
                              >
                                <WhatsAppIcon size={13} />
                              </a>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-[var(--text-secondary)] truncate">
                              {appt.serviceName || appt.title}
                              {appt.totalSessions > 1
                                ? ` • Sessão ${appt.sessionNumber}/${appt.totalSessions}`
                                : ""}
                            </p>
                            <p className="text-[11px] font-semibold tabular-nums text-[var(--brand-champagne)] shrink-0">
                              {appt.priceEstimate !== null
                                ? formatBRL(appt.priceEstimate)
                                : "Valor a definir"}
                            </p>
                          </div>
                        </div>
                      </SwipeableAppointmentCard>
                    </div>
                  </div>
                );
              }

              if (slot.kind === "occupied") {
                return (
                  <div key={`${slot.time}-occ`} className="flex items-center gap-2">
                    <span className="w-10 text-[11px] font-medium tabular-nums text-[var(--text-muted)] text-right shrink-0">
                      {slot.time}
                    </span>
                    <div className="flex-1 pl-2 border-l border-[var(--border-default)]/70">
                      <div className="h-8 rounded-lg bg-[var(--bg-surface)]/65 border border-[var(--border-default)]/80 flex items-center justify-center text-[11px] text-[var(--text-muted)]">
                        Ocupado
                      </div>
                    </div>
                  </div>
                );
              }

              if (slot.kind === "blocked") {
                return (
                  <div key={`${slot.time}-blk`} className="flex items-center gap-2">
                    <span className="w-10 text-[11px] font-medium tabular-nums text-[var(--text-muted)] text-right shrink-0">
                      {slot.time}
                    </span>
                    <div className="flex-1 pl-2 border-l border-[var(--border-default)]/70">
                      <div className="h-8 px-2.5 rounded-lg bg-[var(--status-danger-bg)]/35 border border-[var(--status-danger)]/20 flex items-center justify-center gap-1.5 text-[11px] text-[var(--status-danger)] truncate">
                        <Ban className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          Bloqueado: {slot.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={`${slot.time}-free`} className="flex items-center gap-2">
                  <span className="w-10 text-[11px] font-medium tabular-nums text-[var(--text-secondary)] text-right shrink-0">
                    {slot.time}
                  </span>
                  <div className="flex-1 pl-2 border-l border-[var(--border-default)]/70">
                    <button
                      type="button"
                      onClick={() => {
                        setDate(selectedDate);
                        setStartTime(slot.time);
                        setEndTime(addMinutesToHM(slot.time, durationMinutes));
                        setFormError(null);
                        setCreateOpen(true);
                      }}
                      className="w-full h-8 rounded-lg border border-dashed border-[var(--border-default)] hover:border-[var(--brand-champagne)]/60 hover:bg-[var(--bg-surface)]/50 flex items-center justify-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Agendar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* MODAL iOS DETALHE ARRASTÁVEL PARA O LADO (Tap -> Ver informações + editar + histórico) */}
      {detailAppt ? (
        <IosModalShell
          onClose={() => setDetailAppt(null)}
          dragOffsetX={modalDragX}
          isDragging={modalDragging}
          swipeHandlers={detailSwipeHandlers}
        >
          <div className="p-5 pt-2 space-y-4">
            {/* Barra superior com setas para trocar ou arrastar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentDetailIndex <= 0}
                  onClick={() => navigateDetailBy(-1)}
                  aria-label="Atendimento anterior"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-primary)] disabled:opacity-35 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  disabled={
                    currentDetailIndex < 0 ||
                    currentDetailIndex >= navigableAppointments.length - 1
                  }
                  onClick={() => navigateDetailBy(1)}
                  aria-label="Próximo atendimento"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-primary)] disabled:opacity-35 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                </button>
                {navigableAppointments.length > 1 && currentDetailIndex >= 0 ? (
                  <span className="text-[11px] text-[var(--text-secondary)] pl-1">
                    {currentDetailIndex + 1} de {navigableAppointments.length} •
                    arraste p/ o lado
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--text-secondary)] pl-1">
                    Arraste p/ o lado para fechar
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDetailAppt(null)}
                aria-label="Fechar detalhes"
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>

            {/* Cabeçalho do Atendimento */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold text-[var(--text-primary)] leading-snug">
                  {detailAppt.clientName}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {detailAppt.serviceName || detailAppt.title}
                </p>
              </div>
              <StatusBadge
                label={
                  APPOINTMENT_STATUS_LABELS[detailAppt.status] ||
                  detailAppt.status
                }
                tone={APPOINTMENT_STATUS_TONE[detailAppt.status] || "neutral"}
              />
            </div>

            {/* Segmented interno iOS */}
            <div className="rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] p-1 grid grid-cols-3 gap-1">
              {(
                [
                  ["info", "Informações"],
                  ["edit", "Editar"],
                  ["history", "Histórico"],
                ] as const
              ).map(([tabKey, tabLabel]) => (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setDetailTab(tabKey)}
                  className={`h-8 rounded-full text-xs font-medium cursor-pointer transition-all ${
                    detailTab === tabKey
                      ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  {tabLabel}
                </button>
              ))}
            </div>

            {detailError ? (
              <div className="p-3 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
                {detailError}
              </div>
            ) : null}

            {/* ABA 1: INFORMAÇÕES COMPLETAS */}
            {detailTab === "info" ? (
              <div className="space-y-3.5">
                <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] divide-y divide-[var(--border-default)] text-xs">
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-[var(--text-secondary)]">
                      Data e horário
                    </span>
                    <span className="font-semibold text-[var(--text-primary)] tabular-nums text-right">
                      {formatDateBR(detailAppt.startAt)} •{" "}
                      {formatTimeBR(detailAppt.startAt)} –{" "}
                      {formatTimeBR(detailAppt.endAt)}
                    </span>
                  </div>

                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-[var(--text-secondary)]">
                      Serviço / Sessão
                    </span>
                    <span className="font-medium text-[var(--text-primary)] text-right">
                      {detailAppt.title} ({detailAppt.durationMinutes} min)
                      {detailAppt.totalSessions > 1
                        ? ` • Sessão ${detailAppt.sessionNumber}/${detailAppt.totalSessions}`
                        : ""}
                    </span>
                  </div>

                  {detailAppt.projectName ? (
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-[var(--text-secondary)]">
                        Projeto
                      </span>
                      <span className="font-medium text-[var(--text-primary)] text-right">
                        {detailAppt.projectName}
                      </span>
                    </div>
                  ) : null}

                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-[var(--text-secondary)]">
                      WhatsApp
                    </span>
                    <span className="font-medium text-[var(--text-primary)] tabular-nums">
                      {detailAppt.clientWhatsapp}
                    </span>
                  </div>

                  {detailAppt.preferredPaymentMethod ||
                  detailAppt.priceEstimate !== null ? (
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <PaymentMethodIcon
                          method={detailAppt.preferredPaymentMethod}
                          size={16}
                        />
                        Pagamento
                      </span>
                      <span className="font-semibold text-[var(--text-primary)] tabular-nums text-right">
                        {detailAppt.preferredPaymentMethod
                          ? PAYMENT_METHOD_LABELS[
                              detailAppt.preferredPaymentMethod
                            ] || detailAppt.preferredPaymentMethod
                          : "A definir"}
                        {detailAppt.priceEstimate !== null
                          ? ` • ${formatBRL(detailAppt.priceEstimate)}`
                          : ""}
                      </span>
                    </div>
                  ) : null}

                  {detailAppt.priceEstimate !== null ? (
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-[var(--text-secondary)]">
                        Pago confirmado
                      </span>
                      <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                        {formatBRL(detailAppt.paidAmount)}
                        {detailAppt.depositRequired
                          ? ` (Sinal: ${formatBRL(detailAppt.depositRequired)})`
                          : ""}
                      </span>
                    </div>
                  ) : null}
                </div>

                {detailAppt.clientNotes || detailAppt.internalNotes ? (
                  <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] p-4 space-y-2 text-xs">
                    {detailAppt.clientNotes ? (
                      <div>
                        <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                          Observações da cliente
                        </p>
                        <p className="text-[var(--text-primary)] mt-0.5">
                          {detailAppt.clientNotes}
                        </p>
                      </div>
                    ) : null}
                    {detailAppt.internalNotes ? (
                      <div>
                        <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                          Anotações internas
                        </p>
                        <p className="text-[var(--text-primary)] mt-0.5">
                          {detailAppt.internalNotes}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Controle direto de Status + Ações limpas */}
                <div className="space-y-2.5 pt-1">
                  <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Alterar status
                      </span>
                      <Select
                        value={detailAppt.status}
                        disabled={saving}
                        onChange={(e) =>
                          handleQuickStatusFromDetail(e.target.value)
                        }
                        className="h-8 w-auto min-w-[160px] text-xs py-0"
                      >
                        {Object.entries(APPOINTMENT_STATUS_LABELS).map(
                          ([k, l]) => (
                            <option key={k} value={k}>
                              {l}
                            </option>
                          )
                        )}
                      </Select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {(() => {
                        const nextAction = getNextQuickStatus(
                          detailAppt.status
                        );
                        if (!nextAction) {
                          return (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                handleQuickStatusFromDetail("CONFIRMED")
                              }
                              className="h-9 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={2} />
                              <span>Confirmar</span>
                            </button>
                          );
                        }
                        return (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              handleQuickStatusFromDetail(nextAction.nextStatus)
                            }
                            className="h-9 px-3 rounded-xl bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={2} />
                            <span>{nextAction.label}</span>
                          </button>
                        );
                      })()}

                      <button
                        type="button"
                        disabled={saving || detailAppt.status === "NO_SHOW"}
                        onClick={() => handleQuickStatusFromDetail("NO_SHOW")}
                        className="h-9 px-3 rounded-xl bg-[var(--status-warning-bg)] text-[var(--status-warning)] text-xs font-semibold inline-flex items-center justify-center cursor-pointer disabled:opacity-40"
                      >
                        Faltou
                      </button>

                      <button
                        type="button"
                        disabled={saving || detailAppt.status === "CANCELLED"}
                        onClick={() => handleQuickStatusFromDetail("CANCELLED")}
                        className="h-9 px-3 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs font-semibold inline-flex items-center justify-center cursor-pointer disabled:opacity-40"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>

                  {detailAppt.status === "COMPLETED" &&
                  detailAppt.sessionNumber < detailAppt.totalSessions ? (
                    <button
                      type="button"
                      onClick={() => openNextSessionModal(detailAppt)}
                      className="w-full h-10 px-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/45 text-xs font-semibold text-[var(--brand-champagne)] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Agendar Sessão {detailAppt.sessionNumber + 1}</span>
                    </button>
                  ) : null}

                  <div className="grid grid-cols-4 gap-2">
                    {(() => {
                      const wa = formatWhatsappHref(detailAppt.clientWhatsapp);
                      if (!wa) return null;
                      return (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-9 px-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[11px] font-medium text-[var(--text-primary)]"
                        >
                          <WhatsAppIcon size={14} />
                          <span>Whats</span>
                        </a>
                      );
                    })()}

                    <Link
                      href={`/admin/clientes/${detailAppt.clientId}`}
                      className="h-9 px-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[11px] font-medium text-[var(--text-primary)]"
                    >
                      <UserRound className="h-3.5 w-3.5" />
                      <span>Ficha</span>
                    </Link>

                    <a
                      href={`/api/admin/appointments/${detailAppt.id}/receipt`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-9 px-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[11px] font-medium text-[var(--text-primary)]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>PDF</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => setDeleteApptTarget(detailAppt)}
                      className="h-9 px-2 inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--status-danger-bg)] text-[11px] font-semibold text-[var(--status-danger)] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* ABA 2: EDITAR / ESTENDER HORÁRIO */}
            {detailTab === "edit" ? (
              <form onSubmit={handleUpdateAppt} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Status">
                    <Select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                    >
                      {Object.entries(APPOINTMENT_STATUS_LABELS).map(
                        ([k, l]) => (
                          <option key={k} value={k}>
                            {l}
                          </option>
                        )
                      )}
                    </Select>
                  </Field>
                  <Field label="Data">
                    <IosDatePicker
                      value={editDate}
                      onChange={setEditDate}
                      markedDates={appointmentsCountByDate}
                    />
                  </Field>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Início">
                      <Input
                        type="time"
                        value={editTime}
                        onChange={(e) => {
                          const nextStart = e.target.value;
                          const currDur = diffMinutesBetweenHM(
                            editTime,
                            editEndTime
                          );
                          setEditTime(nextStart);
                          if (currDur >= 15 && currDur <= 720) {
                            setEditEndTime(addMinutesToHM(nextStart, currDur));
                          }
                        }}
                      />
                    </Field>
                    <Field label="Término">
                      <Input
                        type="time"
                        value={editEndTime}
                        onChange={(e) => setEditEndTime(e.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-default)] text-[11px]">
                    <span className="text-[var(--text-secondary)] tabular-nums">
                      Duração:{" "}
                      <strong className="text-[var(--text-primary)]">
                        {formatDurationLabel(
                          diffMinutesBetweenHM(editTime, editEndTime)
                        )}
                      </strong>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--text-muted)] mr-0.5">
                        Estender:
                      </span>
                      {diffMinutesBetweenHM(editTime, editEndTime) > 30 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setEditEndTime(addMinutesToHM(editEndTime, -30))
                          }
                          className="h-6 px-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-[10px] font-semibold hover:bg-[var(--bg-subtle)] cursor-pointer"
                        >
                          -30m
                        </button>
                      ) : null}
                      {[
                        [30, "+30m"],
                        [60, "+1h"],
                        [120, "+2h"],
                      ].map(([delta, label]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() =>
                            setEditEndTime(
                              addMinutesToHM(editEndTime, Number(delta))
                            )
                          }
                          className="h-6 px-2 rounded-full border border-[var(--brand-champagne)]/45 bg-[var(--brand-champagne-subtle)] text-[var(--brand-champagne)] text-[10px] font-semibold cursor-pointer"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Field label="Observações internas">
                  <Textarea
                    value={editInternalNotes}
                    onChange={(e) => setEditInternalNotes(e.target.value)}
                  />
                </Field>

                <Field label="Motivo da alteração (opcional)">
                  <Input
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Ex: Reagendamento solicitado com antecedência"
                  />
                </Field>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDetailTab("info")}
                  >
                    Voltar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </div>
              </form>
            ) : null}

            {/* ABA 3: HISTÓRICO */}
            {detailTab === "history" ? (
              <div className="space-y-2.5">
                {detailAppt.history.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)] py-6 text-center">
                    Nenhuma alteração registrada ainda.
                  </p>
                ) : (
                  <ul className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] divide-y divide-[var(--border-default)] text-xs">
                    {detailAppt.history.map((h) => (
                      <li
                        key={h.id}
                        className="px-4 py-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                            <History className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                            <span>
                              {APPOINTMENT_STATUS_LABELS[h.newStatus] ||
                                h.newStatus}
                            </span>
                          </p>
                          {h.reason ? (
                            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                              {h.reason}
                            </p>
                          ) : null}
                        </div>
                        <span className="text-[11px] text-[var(--text-secondary)] tabular-nums shrink-0">
                          {formatDateTimeBR(h.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </IosModalShell>
      ) : null}

      {/* Modal Criar Agendamento (Compacto iOS + Cadastro Rápido de Cliente) */}
      {createOpen ? (
        <IosModalShell onClose={() => setCreateOpen(false)} maxWidthClass="max-w-md">
          <form onSubmit={handleCreate} className="p-4 pt-1.5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">
                Novo agendamento
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {formError ? (
              <div className="p-2.5 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
                {formError}
              </div>
            ) : null}

            {/* Cliente + botão rápido inline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Cliente
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setAddingClientInline((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-champagne)] hover:opacity-80 cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>
                    {addingClientInline && clientList.length > 0
                      ? "Selecionar cliente"
                      : "+ Novo cliente"}
                  </span>
                </button>
              </div>

              {addingClientInline ? (
                <div className="p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] space-y-2.5">
                  <Input
                    value={quickClientName}
                    onChange={(e) => setQuickClientName(e.target.value)}
                    placeholder="Nome completo da cliente"
                    required={addingClientInline}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={quickClientWhatsapp}
                      onChange={(e) =>
                        setQuickClientWhatsapp(formatPhoneBR(e.target.value))
                      }
                      placeholder="WhatsApp (00) 90000-0000"
                      required={addingClientInline}
                    />
                    <Input
                      type="email"
                      inputMode="email"
                      value={quickClientEmail}
                      onChange={(e) => setQuickClientEmail(e.target.value)}
                      placeholder="E-mail (opcional)"
                    />
                  </div>
                  {clientList.length > 0 ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={savingQuickClient}
                        onClick={() => {
                          setFormError(null);
                          void createQuickClient();
                        }}
                      >
                        {savingQuickClient
                          ? "Salvando cliente..."
                          : "Salvar cliente"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setProjectId("");
                  }}
                  required={!addingClientInline}
                >
                  <option value="">Selecione um cliente</option>
                  {clientList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.whatsapp})
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {!addingClientInline && clientProjects.length > 0 ? (
              <Field label="Projeto vinculado (opcional)">
                <Select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">Sem projeto vinculado</option>
                  {clientProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {services.length > 0 ? (
              <Field label="Serviço cadastrado (opcional)">
                <Select
                  value={selectedServiceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedServiceId(id);
                    const svc = services.find((s) => s.id === id);
                    if (!svc) {
                      setFormTotalSessions(1);
                      return;
                    }
                    setTitle(
                      svc.category.trim()
                        ? `${svc.name} (${svc.category})`
                        : svc.name
                    );
                    setDurationMinutes(svc.durationMinutes);
                    setEndTime(addMinutesToHM(startTime, svc.durationMinutes));
                    setFormTotalSessions(svc.sessionsCount || 1);
                    setFormSessionNumber(1);
                    setPriceEstimate(svc.price > 0 ? svc.price.toFixed(2) : "");
                    setDepositRequired(
                      svc.depositAmount > 0 ? svc.depositAmount.toFixed(2) : ""
                    );
                  }}
                >
                  <option value="">Personalizado / digitar abaixo</option>
                  {services
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.category.trim() ? `[${s.category}] ` : ""}
                        {s.name}
                        {s.sessionsCount > 1 ? ` (${s.sessionsCount} sessões)` : ""}
                        {s.price > 0 ? ` • ${formatBRL(s.price)}` : ""}
                      </option>
                    ))}
                </Select>
              </Field>
            ) : null}

            <Field label="Título da sessão">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Floral Fine Line no antebraço"
                required
              />
            </Field>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Field label="Data">
                  <IosDatePicker
                    value={date}
                    onChange={setDate}
                    markedDates={appointmentsCountByDate}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2.5 sm:col-span-2">
                  <Field label="Início">
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        const currDur = diffMinutesBetweenHM(startTime, endTime);
                        const keepDur =
                          currDur >= 15 && currDur <= 720
                            ? currDur
                            : durationMinutes;
                        setStartTime(nextStart);
                        setEndTime(addMinutesToHM(nextStart, keepDur));
                      }}
                      required
                    />
                  </Field>
                  <Field label="Término">
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => {
                        const nextEnd = e.target.value;
                        setEndTime(nextEnd);
                        const mins = diffMinutesBetweenHM(startTime, nextEnd);
                        if (mins >= 15 && mins <= 720) {
                          setDurationMinutes(mins);
                        }
                      }}
                      required
                    />
                  </Field>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-default)] text-[11px]">
                <span className="text-[var(--text-secondary)] tabular-nums">
                  Duração:{" "}
                  <strong className="text-[var(--text-primary)]">
                    {formatDurationLabel(diffMinutesBetweenHM(startTime, endTime))}
                  </strong>
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    [30, "30m"],
                    [60, "1h"],
                    [90, "1h30"],
                    [120, "2h"],
                  ].map(([mins, lbl]) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => {
                        const d = Number(mins);
                        setDurationMinutes(d);
                        setEndTime(addMinutesToHM(startTime, d));
                      }}
                      className="h-6 px-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-[10px] font-semibold hover:bg-[var(--bg-subtle)] cursor-pointer"
                    >
                      {lbl}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const nextEnd = addMinutesToHM(endTime, 30);
                      setEndTime(nextEnd);
                      const mins = diffMinutesBetweenHM(startTime, nextEnd);
                      if (mins >= 15 && mins <= 720) {
                        setDurationMinutes(mins);
                      }
                    }}
                    className="h-6 px-2 rounded-full border border-[var(--brand-champagne)]/45 bg-[var(--brand-champagne-subtle)] text-[var(--brand-champagne)] text-[10px] font-semibold cursor-pointer"
                  >
                    +30m
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Valor">
                <CurrencyInput
                  value={priceEstimate}
                  onValueChange={setPriceEstimate}
                />
              </Field>
              <Field label="Sinal">
                <CurrencyInput
                  value={depositRequired}
                  onValueChange={setDepositRequired}
                />
              </Field>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedCreate((v) => !v)}
              className="w-full py-2 px-3 rounded-xl bg-[var(--bg-subtle)]/70 border border-[var(--border-default)] flex items-center justify-between text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <span>Opções avançadas (status, recorrência, notas)</span>
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform ${
                  showAdvancedCreate ? "rotate-90" : ""
                }`}
              />
            </button>

            {showAdvancedCreate ? (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Status inicial">
                    <Select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {Object.entries(APPOINTMENT_STATUS_LABELS).map(
                        ([k, l]) => (
                          <option key={k} value={k}>
                            {l}
                          </option>
                        )
                      )}
                    </Select>
                  </Field>
                  <Field label="Intervalo (min)">
                    <Input
                      type="number"
                      min={0}
                      max={180}
                      value={bufferAfterMinutes}
                      onChange={(e) =>
                        setBufferAfterMinutes(Number(e.target.value))
                      }
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Sessões">
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={recurrenceCount}
                      onChange={(e) =>
                        setRecurrenceCount(Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Intervalo (dias)">
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={recurrenceIntervalDays}
                      onChange={(e) =>
                        setRecurrenceIntervalDays(Number(e.target.value))
                      }
                      disabled={recurrenceCount <= 1}
                    />
                  </Field>
                </div>

                <Field label="Observações internas">
                  <Textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Anotações visíveis apenas à administração"
                  />
                </Field>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2 pb-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  saving ||
                  savingQuickClient ||
                  (!addingClientInline && !clientId)
                }
              >
                {saving ? "Agendando..." : "Confirmar"}
              </Button>
            </div>
          </form>
        </IosModalShell>
      ) : null}

      {/* Modal Bloqueios */}
      {blocksOpen ? (
        <IosModalShell onClose={() => setBlocksOpen(false)}>
          <div className="p-5 pt-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">
                Bloqueios de Agenda
              </h3>
              <button
                type="button"
                onClick={() => setBlocksOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={handleCreateBlock}
              className="space-y-3 border-b border-[var(--border-default)] pb-4"
            >
              <Field label="Motivo do bloqueio">
                <Input
                  value={blockTitle}
                  onChange={(e) => setBlockTitle(e.target.value)}
                  placeholder="Ex: Almoço, Feriado, Compromisso externo"
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Data início">
                  <IosDatePicker
                    value={blockStartDate}
                    onChange={setBlockStartDate}
                  />
                </Field>
                <Field label="Hora início">
                  <Input
                    type="time"
                    value={blockStartTime}
                    onChange={(e) => setBlockStartTime(e.target.value)}
                  />
                </Field>
                <Field label="Data fim">
                  <IosDatePicker
                    value={blockEndDate}
                    onChange={setBlockEndDate}
                  />
                </Field>
                <Field label="Hora fim">
                  <Input
                    type="time"
                    value={blockEndTime}
                    onChange={(e) => setBlockEndTime(e.target.value)}
                  />
                </Field>
              </div>
              <Button type="submit" size="sm" disabled={saving}>
                Bloquear período
              </Button>
            </form>

            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {blocks.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between text-xs p-3 rounded-2xl bg-[var(--bg-subtle)]"
                >
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      {b.title}
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                      {formatDateTimeBR(b.startAt)} →{" "}
                      {formatDateTimeBR(b.endAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteBlock(b.id)}
                    className="p-2 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] rounded-full cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </IosModalShell>
      ) : null}

      {/* Modal Horários Disponíveis */}
      {rulesOpen ? (
        <IosModalShell onClose={() => setRulesOpen(false)} maxWidthClass="max-w-xl">
          <form onSubmit={handleSaveRules} className="p-5 pt-2 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock
                  className="h-4 w-4 text-[var(--brand-champagne)]"
                  strokeWidth={1.7}
                />
                <div>
                  <h3 className="font-display text-base font-semibold leading-tight">
                    Horários de Atendimento
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Defina abertura, fechamento e intervalo de cada dia.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRulesOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  setRules((prev) =>
                    prev.map((r) => ({
                      ...r,
                      isActive: r.dayOfWeek >= 1 && r.dayOfWeek <= 5,
                      startTime: "09:00",
                      endTime: "18:00",
                    }))
                  )
                }
                className="h-7 px-3 rounded-full bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/40 text-[11px] font-semibold text-[var(--brand-champagne)] cursor-pointer"
              >
                Padrão Seg–Sex (09:00 às 18:00)
              </button>
            </div>

            <div className="space-y-2.5 max-h-[58vh] overflow-y-auto pr-0.5">
              {rules.map((r, idx) => (
                <div
                  key={r.dayOfWeek}
                  className={`rounded-2xl border p-3.5 space-y-3 transition-colors ${
                    r.isActive
                      ? "bg-[var(--bg-canvas)] border-[var(--border-default)]"
                      : "bg-[var(--bg-canvas)]/45 border-[var(--border-default)]/50 opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          r.isActive
                            ? "bg-[var(--status-success)]"
                            : "bg-[var(--text-muted)]"
                        }`}
                      />
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {WEEKDAYS_FULL[r.dayOfWeek] || WEEKDAYS[r.dayOfWeek]}
                      </span>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.isActive}
                      onClick={() => {
                        const next = [...rules];
                        next[idx] = { ...r, isActive: !r.isActive };
                        setRules(next);
                      }}
                      className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                        r.isActive
                          ? "bg-[var(--status-success-bg)] text-[var(--status-success)]"
                          : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {r.isActive ? "Atendendo" : "Fechado"}
                    </button>
                  </div>

                  {r.isActive ? (
                    <div className="grid grid-cols-3 gap-2">
                      <label className="space-y-1 min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          Abertura
                        </span>
                        <Input
                          type="time"
                          value={r.startTime}
                          onChange={(e) => {
                            const next = [...rules];
                            next[idx] = { ...r, startTime: e.target.value };
                            setRules(next);
                          }}
                          className="h-9 px-2 text-xs tabular-nums w-full"
                        />
                      </label>

                      <label className="space-y-1 min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          Fechamento
                        </span>
                        <Input
                          type="time"
                          value={r.endTime}
                          onChange={(e) => {
                            const next = [...rules];
                            next[idx] = { ...r, endTime: e.target.value };
                            setRules(next);
                          }}
                          className="h-9 px-2 text-xs tabular-nums w-full"
                        />
                      </label>

                      <label className="space-y-1 min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          Intervalo
                        </span>
                        <Select
                          value={String(r.bufferMinutes)}
                          onChange={(e) => {
                            const next = [...rules];
                            next[idx] = {
                              ...r,
                              bufferMinutes: Number(e.target.value),
                            };
                            setRules(next);
                          }}
                          className="h-9 px-2 text-xs tabular-nums w-full"
                        >
                          <option value="0">0 min</option>
                          <option value="10">10 min</option>
                          <option value="15">15 min</option>
                          <option value="20">20 min</option>
                          <option value="30">30 min</option>
                          <option value="45">45 min</option>
                          <option value="60">60 min</option>
                        </Select>
                      </label>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRulesOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar horários"}
              </Button>
            </div>
          </form>
        </IosModalShell>
      ) : null}

      {/* Modal Serviços e Categorias */}
      {servicesOpen ? (
        <IosModalShell
          onClose={() => setServicesOpen(false)}
          maxWidthClass="max-w-2xl"
        >
          <div className="p-5 pt-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold">
                  Serviços e Categorias
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Aparecem para a cliente escolher data, horário e pagamento em
                  /agendar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setServicesOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateService}
              className="p-4 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] space-y-3"
            >
              {svcError ? (
                <div className="p-2.5 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
                  {svcError}
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Field label="Categoria">
                  <Input
                    value={svcCategory}
                    onChange={(e) => setSvcCategory(e.target.value)}
                    placeholder="Ex: Fine Line, Floral, Retoque"
                    required
                  />
                </Field>
                <Field label="Nome do serviço">
                  <Input
                    value={svcName}
                    onChange={(e) => setSvcName(e.target.value)}
                    placeholder="Ex: Tatuagem Minimalista até 6cm"
                    required
                  />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <Field label="Duração (min)">
                  <Input
                    type="number"
                    min={15}
                    max={720}
                    value={svcDuration}
                    onChange={(e) => setSvcDuration(Number(e.target.value))}
                    required
                  />
                </Field>
                <Field label="Valor">
                  <CurrencyInput
                    value={svcPrice}
                    onValueChange={setSvcPrice}
                    required
                  />
                </Field>
                <Field label="Sinal">
                  <CurrencyInput
                    value={svcDeposit}
                    onValueChange={setSvcDeposit}
                  />
                </Field>
              </div>

              <Field label="Descrição curta (opcional)">
                <Input
                  value={svcDescription}
                  onChange={(e) => setSvcDescription(e.target.value)}
                  placeholder="Inclui arte simples e orientações..."
                />
              </Field>

              <Button type="submit" size="sm" disabled={saving}>
                <Plus className="h-3.5 w-3.5" strokeWidth={1.6} />
                {saving ? "Cadastrando..." : "Cadastrar serviço"}
              </Button>
            </form>

            <div className="space-y-2">
              {services.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)] text-center py-4">
                  Nenhum serviço cadastrado ainda. Crie o primeiro acima.
                </p>
              ) : (
                services.map((svc) => (
                  <div
                    key={svc.id}
                    className="p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--brand-champagne)]">
                          {svc.category}
                        </span>
                        <StatusBadge
                          label={svc.isActive ? "Ativo" : "Pausado"}
                          tone={svc.isActive ? "success" : "neutral"}
                        />
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate mt-0.5">
                        {svc.name}
                      </p>
                      <p className="text-[var(--text-secondary)] tabular-nums">
                        {svc.durationMinutes} min • {formatBRL(svc.price)}
                        {svc.depositAmount > 0
                          ? ` (Sinal: ${formatBRL(svc.depositAmount)})`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => toggleServiceActive(svc)}
                      >
                        {svc.isActive ? "Pausar" : "Ativar"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => deleteService(svc.id)}
                        className="p-2 rounded-full text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] cursor-pointer"
                        aria-label="Excluir serviço"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </IosModalShell>
      ) : null}

      {/* Modal Ajustes Rápidos da Agenda (Serviços, Horários, Bloqueios, Filtro) */}
      {toolsOpen ? (
        <IosModalShell onClose={() => setToolsOpen(false)} maxWidthClass="max-w-sm">
          <div className="p-4 pt-1.5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">
                Ajustes da Agenda
              </h3>
              <button
                type="button"
                onClick={() => setToolsOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)] divide-y divide-[var(--border-default)] overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => {
                  setToolsOpen(false);
                  setServicesOpen(true);
                }}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <span className="inline-flex items-center gap-2 font-medium text-[var(--text-primary)]">
                  <Sparkles className="h-4 w-4 text-[var(--brand-champagne)]" />
                  Serviços e Categorias ({services.length})
                </span>
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setToolsOpen(false);
                  setRulesOpen(true);
                }}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <span className="inline-flex items-center gap-2 font-medium text-[var(--text-primary)]">
                  <Clock className="h-4 w-4 text-[var(--brand-champagne)]" />
                  Horários de Atendimento
                </span>
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setToolsOpen(false);
                  setBlocksOpen(true);
                }}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <span className="inline-flex items-center gap-2 font-medium text-[var(--text-primary)]">
                  <Ban className="h-4 w-4 text-[var(--status-danger)]" />
                  Bloqueios ({blocks.length})
                </span>
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
              </button>
            </div>

            <Field label="Filtrar por status">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Todos os status</option>
                {Object.entries(APPOINTMENT_STATUS_LABELS).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </IosModalShell>
      ) : null}

      <ConfirmModal
        open={Boolean(deleteApptTarget)}
        title="Excluir agendamento?"
        description={
          deleteApptTarget
            ? `Remover "${deleteApptTarget.clientName}" (${formatTimeBR(deleteApptTarget.startAt)}) da agenda?`
            : "Esta ação remove o agendamento da agenda."
        }
        confirmLabel="Excluir"
        loading={saving}
        onConfirm={handleDeleteAppt}
        onCancel={() => setDeleteApptTarget(null)}
      />
    </div>
  );
}

export function AgendaClient(props: {
  initialDate: string;
  initialAppointments: AppointmentItem[];
  initialBlocks: BlockItem[];
  initialRules: RuleItem[];
  clients: Array<{ id: string; fullName: string; whatsapp: string }>;
  projects: Array<{ id: string; name: string; clientId: string }>;
  initialServices: ServiceItem[];
}) {
  return (
    <Suspense
      fallback={
        <div className="text-xs text-[var(--text-secondary)]">
          Carregando agenda...
        </div>
      }
    >
      <AgendaInner {...props} />
    </Suspense>
  );
}
