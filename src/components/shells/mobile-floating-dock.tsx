"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export interface DockNavItem {
  key?: string;
  href?: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  onClick?: () => void;
  active?: boolean;
  badgeCount?: number;
}

export function MobileFloatingDock({
  items,
  isActive,
  ariaLabel,
}: {
  items: DockNavItem[];
  isActive: (href: string, exact: boolean) => boolean;
  ariaLabel: string;
}) {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const dragMeta = useRef<{
    pointerId: number | null;
    startX: number;
    moved: boolean;
  }>({
    pointerId: null,
    startX: 0,
    moved: false,
  });

  const activeIndex = useMemo(() => {
    const idx = items.findIndex((item) =>
      item.active !== undefined
        ? item.active
        : item.href
          ? isActive(item.href, Boolean(item.exact))
          : false
    );
    return idx >= 0 ? idx : 0;
  }, [items, isActive]);

  const highlightedIndex =
    dragging && hoverIndex !== null ? hoverIndex : activeIndex;

  const updateDragPosition = (clientX: number) => {
    const el = trackRef.current;
    if (!el || items.length === 0) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const rawRel = Math.max(0, Math.min(width, clientX - rect.left));
    const slotW = width / items.length;
    const clampedCenter = Math.max(
      slotW / 2,
      Math.min(width - slotW / 2, rawRel)
    );
    const pillStartIndexFloat = (clampedCenter - slotW / 2) / slotW;
    const idx = Math.max(
      0,
      Math.min(items.length - 1, Math.floor((rawRel / width) * items.length))
    );
    setDragFraction(pillStartIndexFloat);
    setHoverIndex(idx);
  };

  const resetDrag = () => {
    dragMeta.current = { pointerId: null, startX: 0, moved: false };
    setDragging(false);
    setDragFraction(null);
    setHoverIndex(null);
  };

  const commitSelection = (idx: number) => {
    const target = items[idx];
    if (!target) return;
    if (target.onClick) {
      target.onClick();
    } else if (target.href) {
      router.push(target.href);
    }
  };

  const colsClass = items.length === 5 ? "grid-cols-5" : "grid-cols-4";
  const pillIndexFloat =
    dragging && dragFraction !== null ? dragFraction : activeIndex;

  return (
    <nav
      aria-label={ariaLabel}
      className="md:hidden fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 pointer-events-none"
    >
      <div className="max-w-md mx-auto pointer-events-auto rounded-full bg-[var(--bg-surface)]/85 backdrop-blur-xl border border-[var(--border-strong)]/80 shadow-[0_14px_38px_rgba(0,0,0,0.55)] p-1.5">
        <div
          ref={trackRef}
          onPointerDown={(e) => {
            if (e.button !== 0 && e.pointerType === "mouse") return;
            dragMeta.current = {
              pointerId: e.pointerId,
              startX: e.clientX,
              moved: false,
            };
          }}
          onPointerMove={(e) => {
            if (dragMeta.current.pointerId !== e.pointerId) return;
            const dx = Math.abs(e.clientX - dragMeta.current.startX);
            if (!dragMeta.current.moved && dx > 7) {
              dragMeta.current.moved = true;
              setDragging(true);
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // ignore
              }
            }
            if (dragMeta.current.moved) {
              updateDragPosition(e.clientX);
            }
          }}
          onPointerUp={(e) => {
            if (dragMeta.current.pointerId !== e.pointerId) return;
            const wasDragged = dragMeta.current.moved;
            const targetIdx = hoverIndex;
            try {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            } catch {
              // ignore
            }
            resetDrag();
            if (wasDragged && targetIdx !== null && targetIdx !== activeIndex) {
              commitSelection(targetIdx);
            }
          }}
          onPointerCancel={resetDrag}
          onClickCapture={(e) => {
            if (dragMeta.current.moved) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          style={{ touchAction: "none" }}
          className={`relative grid ${colsClass} items-center select-none`}
        >
          {/* Pílula indicadora deslizante estilo iOS */}
          <span
            aria-hidden="true"
            style={{
              width: `${100 / items.length}%`,
              transform: `translate3d(${pillIndexFloat * 100}%, 0, 0) scale(${
                dragging ? 1.06 : 1
              })`,
              transition: dragging
                ? "transform 35ms linear, box-shadow 150ms ease"
                : "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            className="pointer-events-none absolute left-0 top-0 h-12 rounded-full bg-[var(--action-primary)] shadow-[0_4px_14px_rgba(0,0,0,0.28)]"
          />

          {items.map((item, idx) => {
            const highlighted = idx === highlightedIndex;
            const Icon = item.icon;
            const itemClass = `relative z-10 h-12 flex flex-col items-center justify-center gap-0.5 rounded-full text-[10px] transition-colors cursor-pointer ${
              highlighted
                ? "text-[var(--action-primary-fg)] font-semibold"
                : "text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)]"
            }`;

            const content = (
              <>
                <span className="relative inline-flex items-center justify-center">
                  <Icon
                    className="h-[18px] w-[18px]"
                    strokeWidth={highlighted ? 2 : 1.6}
                  />
                  {item.badgeCount && item.badgeCount > 0 ? (
                    <span
                      className={`absolute -top-1 -right-1.5 h-2 w-2 rounded-full ${
                        highlighted
                          ? "bg-[var(--brand-champagne)]"
                          : "bg-[var(--status-warning)]"
                      }`}
                    />
                  ) : null}
                </span>
                <span className="leading-none whitespace-nowrap">
                  {item.label}
                </span>
              </>
            );

            if (item.onClick) {
              return (
                <button
                  key={item.key ?? item.label}
                  type="button"
                  onClick={item.onClick}
                  aria-expanded={highlighted}
                  className={itemClass}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.key ?? item.href ?? item.label}
                href={item.href || "#"}
                prefetch={true}
                draggable={false}
                className={itemClass}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
