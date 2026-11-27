"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LogOut, Moon, Sun, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { BrandLogo } from "@/components/brand-mark";
import { InstallAppButton } from "@/components/public/install-app-button";
import {
  InstallGuideContent,
  LoginForm,
  SignupForm,
} from "@/components/public/public-sheet-content";
import { useTheme } from "@/components/theme-provider";

type SheetMode = "signup" | "login" | "install" | null;

interface PublicEntryProps {
  studioName: string;
  ownerName: string;
  igHandle: string;
  igSlug: string;
  waRaw: string;
  waClean: string;
  isOpenToday: boolean;
  todayHours: string;
  user: { name: string } | null;
}

export function PublicEntryView({
  studioName,
  ownerName,
  igHandle,
  igSlug,
  waRaw,
  waClean,
  isOpenToday,
  todayHours,
  user,
}: PublicEntryProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogoutSwitch = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setLoggingOut(false);
    router.refresh();
  };
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const openSheet = useCallback((mode: Exclude<SheetMode, null>) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setDragOffsetY(0);
    setSheetOpen(false);
    setSheetMode(mode);

    // Garante que o frame inicial (fora da tela) seja pintado antes da transição estilo iOS
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setSheetOpen(true);
      });
    });
  }, []);

  const closeSheet = useCallback(() => {
    if (!sheetMode) return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setDragOffsetY(0);
    setSheetOpen(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setSheetMode(null);
      closeTimerRef.current = null;
    }, 420);
  }, [sheetMode]);

  useEffect(() => {
    if (!sheetMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sheetMode, closeSheet]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) {
      setDragOffsetY(Math.min(delta, 260));
    }
  };

  const handleTouchEnd = () => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    if (dragOffsetY > 90) {
      closeSheet();
    } else {
      setDragOffsetY(0);
    }
  };

  return (
    <div className="min-h-dvh bg-black relative overflow-x-clip">
      {/* Plano principal com efeito de profundidade iOS quando o modal abre */}
      <div
        data-open={sheetOpen ? "true" : "false"}
        className="ios-bg-stage min-h-dvh flex flex-col justify-between bg-[var(--bg-canvas)] text-[var(--text-primary)] px-4 py-5 sm:py-6 origin-top"
      >
        {/* Barra superior minimalista: Instalar App + Tema */}
        <header className="w-full max-w-md mx-auto flex items-center justify-end gap-2">
          <InstallAppButton dark={isDark} onClick={() => openSheet("install")} />
          <button
            type="button"
            onClick={() => toggleTheme(Boolean(user))}
            aria-label="Alternar tema claro ou escuro"
            title="Alternar tema"
            className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all active:scale-[0.94]"
          >
            {isDark ? (
              <Sun className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <Moon className="h-4 w-4" strokeWidth={1.5} />
            )}
          </button>
        </header>

        {/* Bloco central minimalista: logo, contato organizado e ações */}
        <main className="w-full max-w-sm mx-auto my-auto py-8 flex flex-col items-center text-center space-y-6">
          <h1 className="sr-only">
            {studioName} — {ownerName}
          </h1>

          <div className="flex justify-center">
            <Image
              src="/brand/zanima-logo.png"
              alt={`Logotipo ${studioName}`}
              width={340}
              height={286}
              className="w-60 sm:w-68 h-auto object-contain"
              priority
            />
          </div>

          {/* Instagram, WhatsApp e horário organizados em cápsulas */}
          <div className="w-full flex flex-col items-center gap-2.5">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href={`https://instagram.com/${igSlug}`}
                target="_blank"
                rel="noreferrer"
                className="h-8 px-3.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 hover:bg-[var(--bg-subtle)] transition-all active:scale-[0.96]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5 text-[var(--brand-champagne)]"
                  aria-hidden="true"
                >
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
                <span>{igHandle}</span>
              </a>

              {waClean ? (
                <a
                  href={`https://wa.me/${waClean}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 px-3.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 hover:bg-[var(--bg-subtle)] transition-all active:scale-[0.96]"
                >
                  <WhatsAppIcon size={15} />
                  <span>{waRaw}</span>
                </a>
              ) : null}
            </div>

            <div className="h-7 px-3 rounded-full bg-[var(--bg-surface)]/65 border border-[var(--border-default)] inline-flex items-center gap-2 text-[11px] font-medium text-[var(--text-secondary)]">
              <span
                className={`h-2 w-2 rounded-full ${
                  isOpenToday
                    ? "bg-[var(--status-success)]"
                    : "bg-[var(--brand-champagne)]"
                }`}
              />
              <span>{todayHours}</span>
            </div>
          </div>

          {/* Botões estilo iOS arredondados */}
          {user ? (
            <div className="w-full space-y-2.5 pt-1">
              <Link
                href="/minha-conta"
                className="w-full h-12 px-6 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-sm font-semibold hover:bg-[var(--action-primary-hover)] transition-all active:scale-[0.98]"
              >
                <span>Acessar Minha Conta</span>
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
              <button
                type="button"
                disabled={loggingOut}
                onClick={handleLogoutSwitch}
                className="w-full h-11 px-6 inline-flex items-center justify-center gap-2 rounded-full text-xs font-semibold transition-all active:scale-[0.97] bg-[#EFEAE2] text-[#18181B] hover:bg-[#E5DEC9] cursor-pointer disabled:opacity-60"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.7} />
                <span>{loggingOut ? "Saindo..." : "Sair / Trocar conta"}</span>
              </button>
              <p className="text-xs text-[var(--text-secondary)]">
                Conectado como {user.name}
              </p>
            </div>
          ) : (
            <div className="w-full space-y-3 pt-1">
              <button
                type="button"
                onClick={() => openSheet("signup")}
                className="w-full h-12 px-6 inline-flex items-center justify-center rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-sm font-semibold hover:bg-[var(--action-primary-hover)] transition-all active:scale-[0.97] cursor-pointer"
              >
                Criar Conta
              </button>
              <button
                type="button"
                onClick={() => openSheet("login")}
                className="w-full h-12 px-6 inline-flex items-center justify-center rounded-full text-sm font-medium transition-all active:scale-[0.97] bg-[#EFEAE2] text-[#18181B] hover:bg-[#E5DEC9] cursor-pointer"
              >
                Já tenho conta
              </button>
            </div>
          )}
        </main>

        {/* Rodapé formal e discreto */}
        <footer className="w-full max-w-md mx-auto pt-5 border-t border-[var(--border-default)] flex flex-col items-center gap-2 text-center">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--text-secondary)]">
            <Link
              href="/termos"
              className="hover:text-[var(--text-primary)] underline-offset-4 hover:underline"
            >
              Termos de Uso
            </Link>
            <span aria-hidden="true">•</span>
            <Link
              href="/privacidade"
              className="hover:text-[var(--text-primary)] underline-offset-4 hover:underline"
            >
              Política de Privacidade
            </Link>
          </div>
          <p className="text-[11px] tracking-[0.06em] uppercase text-[var(--text-secondary)]">
            DESENVOLVIDO POR{" "}
            <a
              href="https://www.instagram.com/pconconstrunet/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--text-primary)] hover:underline underline-offset-4 transition-colors"
            >
              P-CON CONSTRUNET LTDA
            </a>
          </p>
        </footer>
      </div>

      {/* Modal Sheet estilo iOS */}
      {sheetMode ? (
        <div
          data-open={sheetOpen ? "true" : "false"}
          className="ios-modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSheet();
          }}
        >
          <div
            data-open={sheetOpen ? "true" : "false"}
            style={
              dragOffsetY > 0
                ? { transform: `translate3d(0, ${dragOffsetY}px, 0)`, opacity: 1, transition: "none" }
                : undefined
            }
            className="ios-modal-sheet w-full sm:max-w-sm bg-[var(--bg-surface)] border-t sm:border border-white/12 rounded-t-[32px] sm:rounded-[32px] px-5 pt-2.5 pb-7 sm:pb-6 shadow-[0_-16px_48px_rgba(0,0,0,0.65)] max-h-[92dvh] overflow-y-auto overflow-x-hidden overscroll-contain"
          >
            {/* Barra arrastável estilo iOS */}
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="pt-1 pb-3 flex flex-col items-center touch-none cursor-grab active:cursor-grabbing"
            >
              <div className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between gap-3">
                <BrandLogo href="" compact />
                <button
                  type="button"
                  onClick={closeSheet}
                  aria-label="Fechar janela"
                  className="h-8 w-8 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-90 cursor-pointer shrink-0"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>

              <div>
                <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                  {sheetMode === "signup"
                    ? "Criar conta"
                    : sheetMode === "login"
                      ? "Acessar conta"
                      : "Instalar App ZANIMA"}
                </h2>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {sheetMode === "signup"
                    ? "Cadastro rápido de cliente"
                    : sheetMode === "login"
                      ? "Entre com seu e-mail e senha"
                      : "Adicione à tela inicial do celular"}
                </p>
              </div>
            </div>

            {sheetMode === "signup" ? (
              <SignupForm
                onSwitchToLogin={() => setSheetMode("login")}
                onSuccess={closeSheet}
              />
            ) : null}

            {sheetMode === "login" ? (
              <LoginForm
                onSwitchToSignup={() => setSheetMode("signup")}
                onSuccess={closeSheet}
              />
            ) : null}

            {sheetMode === "install" ? (
              <InstallGuideContent
                onActionSignup={() => setSheetMode("signup")}
                onActionLogin={() => setSheetMode("login")}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
