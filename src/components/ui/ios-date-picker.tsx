"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toISODateSP } from "@/lib/format";

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAYS_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];

function parseYMD(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    const today = toISODateSP();
    const [y, m, d] = today.split("-").map(Number);
    return { year: y, month: m, day: d };
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formatDisplayDateBR(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "Selecionar data";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function IosDatePicker({
  value,
  onChange,
  variant = "field",
  markedDates,
  minDate,
  ariaLabel = "Selecionar data",
  className = "",
}: {
  value: string;
  onChange: (nextDate: string) => void;
  variant?: "pill" | "field" | "icon";
  markedDates?: Map<string, number> | Set<string>;
  minDate?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const initialParsed = parseYMD(value);
  const [viewYear, setViewYear] = useState(initialParsed.year);
  const [viewMonth, setViewMonth] = useState(initialParsed.month);

  const todayISO = toISODateSP();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const openPicker = () => {
    const parsed = parseYMD(value);
    setViewYear(parsed.year);
    setViewMonth(parsed.month);
    setOpen(true);
  };

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const calendarCells = useMemo(() => {
    const firstDayWeekday = new Date(
      Date.UTC(viewYear, viewMonth - 1, 1)
    ).getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
    const prevMonthYear = viewMonth === 1 ? viewYear - 1 : viewYear;
    const prevMonthNum = viewMonth === 1 ? 12 : viewMonth - 1;
    const daysInPrevMonth = new Date(
      Date.UTC(prevMonthYear, prevMonthNum, 0)
    ).getUTCDate();

    const cells: Array<{
      dateKey: string;
      dayNum: number;
      inCurrentMonth: boolean;
    }> = [];

    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const dateKey = `${prevMonthYear}-${String(prevMonthNum).padStart(
        2,
        "0"
      )}-${String(d).padStart(2, "0")}`;
      cells.push({ dateKey, dayNum: d, inCurrentMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(
        d
      ).padStart(2, "0")}`;
      cells.push({ dateKey, dayNum: d, inCurrentMonth: true });
    }

    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const needed = 7 - remainder;
      const nextMonthYear = viewMonth === 12 ? viewYear + 1 : viewYear;
      const nextMonthNum = viewMonth === 12 ? 1 : viewMonth + 1;
      for (let d = 1; d <= needed; d++) {
        const dateKey = `${nextMonthYear}-${String(nextMonthNum).padStart(
          2,
          "0"
        )}-${String(d).padStart(2, "0")}`;
        cells.push({ dateKey, dayNum: d, inCurrentMonth: false });
      }
    }

    return cells;
  }, [viewYear, viewMonth]);

  const hasMarker = (dateKey: string) => {
    if (!markedDates) return false;
    if (markedDates instanceof Set) return markedDates.has(dateKey);
    return (markedDates.get(dateKey) || 0) > 0;
  };

  const triggerClass =
    variant === "icon"
      ? `h-9 w-9 inline-flex items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors cursor-pointer ${className}`
      : variant === "pill"
        ? `h-8 px-3 inline-flex items-center gap-2 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors cursor-pointer ${className}`
        : `w-full h-10 px-3.5 inline-flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors cursor-pointer ${className}`;

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={openPicker}
        className={triggerClass}
      >
        {variant !== "icon" ? (
          <span className="tabular-nums">{formatDisplayDateBR(value)}</span>
        ) : null}
        <CalendarIcon
          className={
            variant === "icon"
              ? "h-4 w-4 text-[var(--text-primary)] shrink-0"
              : "h-3.5 w-3.5 text-[var(--brand-champagne)] shrink-0"
          }
          strokeWidth={1.8}
        />
      </button>

      {open ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          className="ios-backdrop-in fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-md p-0 sm:p-4"
        >
          <div className="ios-page-enter w-full max-w-[360px] bg-[var(--bg-surface)] border border-[var(--border-strong)]/80 rounded-t-[28px] sm:rounded-[28px] shadow-[0_24px_70px_rgba(0,0,0,0.7)] p-5 space-y-4">
            <div className="sm:hidden -mt-2 mb-1 flex justify-center">
              <span className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
            </div>

            {/* Cabeçalho do calendário */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--brand-champagne)] font-semibold">
                  {viewYear}
                </p>
                <h3 className="font-display text-lg font-semibold text-[var(--text-primary)] leading-tight">
                  {MONTHS_PT[viewMonth - 1]}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={prevMonth}
                  aria-label="Mês anterior"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-all active:scale-[0.94]"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  aria-label="Próximo mês"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-all active:scale-[0.94]"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar calendário"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all active:scale-[0.94]"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>

            {/* Dias da semana */}
            <div className="grid grid-cols-7 text-center">
              {WEEKDAYS_SHORT.map((wd, i) => (
                <span
                  key={`${wd}-${i}`}
                  className="text-[11px] font-semibold text-[var(--text-muted)] py-1"
                >
                  {wd}
                </span>
              ))}
            </div>

            {/* Grade de dias personalizada */}
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell) => {
                const isSelected = cell.dateKey === value;
                const isToday = cell.dateKey === todayISO;
                const isBeforeMin = Boolean(minDate && cell.dateKey < minDate);
                const marked = hasMarker(cell.dateKey);

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    disabled={isBeforeMin}
                    onClick={() => {
                      if (isBeforeMin) return;
                      onChange(cell.dateKey);
                      setOpen(false);
                    }}
                    className={`relative h-10 rounded-2xl flex flex-col items-center justify-center text-xs font-medium tabular-nums transition-all ${
                      isBeforeMin
                        ? "opacity-25 cursor-not-allowed text-[var(--text-muted)]"
                        : isSelected
                          ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold shadow-sm cursor-pointer active:scale-[0.92]"
                          : isToday
                            ? "bg-[var(--brand-champagne-subtle)] text-[var(--brand-champagne)] border border-[var(--brand-champagne)]/45 font-semibold cursor-pointer active:scale-[0.92]"
                            : cell.inCurrentMonth
                              ? "text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer active:scale-[0.92]"
                              : "text-[var(--text-muted)]/60 hover:bg-[var(--bg-subtle)]/50 cursor-pointer active:scale-[0.92]"
                    }`}
                  >
                    <span>{cell.dayNum}</span>
                    {marked ? (
                      <span
                        className={`h-1 w-1 rounded-full mt-0.5 ${
                          isSelected
                            ? "bg-[var(--brand-champagne)]"
                            : "bg-[var(--brand-champagne)]"
                        }`}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Rodapé rápido */}
            <div className="pt-2 border-t border-[var(--border-default)] flex items-center justify-between gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={Boolean(minDate && todayISO < minDate)}
                onClick={() => {
                  onChange(todayISO);
                  setOpen(false);
                }}
                className="h-9 px-4 rounded-full bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/35 text-xs font-semibold text-[var(--brand-champagne)] cursor-pointer transition-all active:scale-[0.96] disabled:opacity-40"
              >
                Hoje
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 px-4 rounded-full bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all active:scale-[0.96]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
