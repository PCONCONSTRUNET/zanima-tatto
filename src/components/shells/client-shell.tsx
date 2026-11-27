"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookHeart,
  Calendar,
  Home,
  LogOut,
  Moon,
  Receipt,
  Sparkles,
  Sun,
  UserCircle,
  Wallet,
} from "lucide-react";
import { BrandLogo, PconSignature } from "@/components/brand-mark";
import { MobileFloatingDock } from "@/components/shells/mobile-floating-dock";
import { useTheme } from "@/components/theme-provider";
import { OneSignalUserSync } from "@/components/onesignal-init";
import { PushOptInButton } from "@/components/ui/push-opt-in-button";
import type { SafeSessionUser } from "@/lib/security/session";

const CLIENT_MOBILE_NAV = [
  { href: "/minha-conta", label: "Início", icon: Home, exact: true },
  { href: "/minha-conta/agenda", label: "Agenda", icon: Calendar, exact: false },
  {
    href: "/minha-conta/financeiro",
    label: "Pagamentos",
    icon: Wallet,
    exact: false,
  },
  { href: "/minha-conta/perfil", label: "Perfil", icon: UserCircle, exact: false },
];

const CLIENT_DESKTOP_NAV = [
  { href: "/minha-conta", label: "Início", icon: Home, exact: true },
  { href: "/minha-conta/agenda", label: "Agenda", icon: Calendar, exact: false },
  {
    href: "/minha-conta/minhas-tattoos",
    label: "Minhas tattoos",
    icon: Sparkles,
    exact: false,
  },
  {
    href: "/minha-conta/minha-historia-na-pele",
    label: "Minha História na Pele",
    icon: BookHeart,
    exact: false,
  },
  {
    href: "/minha-conta/proxima-tattoo",
    label: "Minha Próxima Tattoo",
    icon: Sparkles,
    exact: false,
  },
  {
    href: "/minha-conta/financeiro",
    label: "Pagamentos",
    icon: Wallet,
    exact: false,
  },
  { href: "/minha-conta/perfil", label: "Perfil", icon: UserCircle, exact: false },
];

export function ClientShell({
  user,
  children,
}: {
  user: SafeSessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/entrar");
    router.refresh();
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <OneSignalUserSync userId={user.id} role={user.role} />
      <header className="sticky top-0 z-20 bg-[var(--bg-surface)] border-b border-[var(--border-default)]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <BrandLogo href="/minha-conta" compact />
            <span className="hidden sm:inline-block h-4 w-px bg-[var(--border-default)]" />
            <span className="hidden sm:inline text-xs text-[var(--text-secondary)]">
              Área do Cliente • {user.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <PushOptInButton userId={user.id} role={user.role} compact />
            <Link
              href="/orcamento"
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-[var(--border-default)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            >
              <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
              Novo orçamento
            </Link>
            <button
              type="button"
              onClick={() => toggleTheme(true)}
              aria-label="Alternar tema"
              className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-all active:scale-[0.94]"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Sair da conta"
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] text-xs text-[var(--text-secondary)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] cursor-pointer transition-all active:scale-[0.94]"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        {/* Submenu Desktop Horizontal Limpo */}
        <div className="hidden md:block border-t border-[var(--border-default)] bg-[var(--bg-surface)]">
          <nav
            aria-label="Menu Área do Cliente"
            className="max-w-6xl mx-auto px-6 flex items-center gap-1 overflow-x-auto"
          >
            {CLIENT_DESKTOP_NAV.map((item) => {
              const active = isActive(item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 h-10 px-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                    active
                      ? "border-[var(--action-primary)] text-[var(--text-primary)]"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 py-5 pb-24 md:pb-10">
        {children}
      </main>

      <footer className="hidden md:flex items-center justify-between max-w-6xl w-full mx-auto px-6 py-4 border-t border-[var(--border-default)]">
        <PconSignature />
        <Link
          href="/"
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Voltar ao Portal do Estúdio
        </Link>
      </footer>

      <MobileFloatingDock
        items={CLIENT_MOBILE_NAV}
        isActive={isActive}
        ariaLabel="Navegação cliente mobile"
      />
    </div>
  );
}
