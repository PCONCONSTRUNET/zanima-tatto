"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FolderKanban,
  Gift,
  Globe,
  Home,
  LayoutGrid,
  LogOut,
  Moon,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Sun,
  UserCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  BrandLogo,
  BrandMonogramOnly,
  PconSignature,
} from "@/components/brand-mark";
import {
  MobileFloatingDock,
  type DockNavItem,
} from "@/components/shells/mobile-floating-dock";
import { useTheme } from "@/components/theme-provider";
import { OneSignalUserSync } from "@/components/onesignal-init";
import { PushOptInButton } from "@/components/ui/push-opt-in-button";
import { PushPromptModal } from "@/components/ui/push-prompt-modal";
import type { SafeSessionUser } from "@/lib/security/session";

const PRIMARY_MOBILE_HREFS = [
  "/admin",
  "/admin/agenda",
  "/admin/clientes",
  "/admin/financeiro",
];

const SIDEBAR_GROUPS = [
  {
    title: "Principal",
    items: [
      { href: "/admin", label: "Início", icon: Home, exact: true },
      { href: "/admin/agenda", label: "Agenda", icon: Calendar, exact: false },
      { href: "/admin/servicos", label: "Serviços", icon: Sparkles, exact: false },
      { href: "/admin/clientes", label: "Clientes", icon: Users, exact: false },
      {
        href: "/admin/projetos",
        label: "Projetos",
        icon: FolderKanban,
        exact: false,
      },
      {
        href: "/admin/orcamentos",
        label: "Orçamentos",
        icon: Receipt,
        exact: false,
      },
    ],
  },
  {
    title: "Gestão & Operação",
    items: [
      {
        href: "/admin/financeiro",
        label: "Financeiro",
        icon: Wallet,
        exact: false,
      },
      {
        href: "/admin/pessoal",
        label: "Pessoal",
        icon: UserCheck,
        exact: false,
      },
      {
        href: "/admin/estoque",
        label: "Estoque",
        icon: Package,
        exact: false,
      },
      {
        href: "/admin/fidelizacao",
        label: "Fidelização",
        icon: Gift,
        exact: false,
      },
      {
        href: "/admin/lembretes",
        label: "Lembretes & Notas",
        icon: StickyNote,
        exact: false,
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        href: "/admin/push",
        label: "Notificações Push",
        icon: BellRing,
        exact: false,
      },
      {
        href: "/admin/notificacoes",
        label: "Central de Notificações",
        icon: Bell,
        exact: false,
      },
      {
        href: "/admin/configuracoes",
        label: "Configurações",
        icon: Settings,
        exact: false,
      },
    ],
  },
];

function SidebarNavGroups({
  collapsed,
  isActive,
  unreadNotifications,
  onNavigate,
}: {
  collapsed: boolean;
  isActive: (href: string, exact: boolean) => boolean;
  unreadNotifications: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
      {SIDEBAR_GROUPS.map((group) => (
        <div key={group.title} className="space-y-1.5">
          {!collapsed ? (
            <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {group.title}
            </p>
          ) : null}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(item.href, item.exact);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={true}
                    title={collapsed ? item.label : undefined}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 h-10 px-3 rounded-xl text-[13px] font-medium transition-all ${
                      active
                        ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] shadow-sm font-semibold"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                    } ${collapsed ? "justify-center px-0" : ""}`}
                  >
                    <Icon
                      className="h-4 w-4 shrink-0"
                      strokeWidth={active ? 2 : 1.6}
                    />
                    {!collapsed ? (
                      <span className="truncate flex-1">{item.label}</span>
                    ) : null}
                    {!collapsed &&
                    item.href === "/admin/notificacoes" &&
                    unreadNotifications > 0 ? (
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded-full tabular-nums font-semibold ${
                          active
                            ? "bg-[var(--action-primary-fg)]/15 text-[var(--action-primary-fg)]"
                            : "bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
                        }`}
                      >
                        {unreadNotifications}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({
  user,
  unreadNotifications,
  children,
}: {
  user: SafeSessionUser;
  unreadNotifications: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerPathname, setDrawerPathname] = useState<string | null>(null);
  const drawerOpen = drawerPathname === pathname;
  const setDrawerOpen = (open: boolean | ((prev: boolean) => boolean)) => {
    setDrawerPathname((current) => {
      const prevOpen = current === pathname;
      const nextOpen = typeof open === "function" ? open(prevOpen) : open;
      return nextOpen ? pathname : null;
    });
  };
  const [hideValues, setHideValues] = useState(user.hideFinancialValues);
  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = (href: string, exact: boolean) =>
    exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const isMoreRouteActive = !PRIMARY_MOBILE_HREFS.some((href) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(`${href}/`)
  );

  // Pré-carrega abas principais em segundo plano para troca instantânea sem delay
  useEffect(() => {
    const hotRoutes = [
      "/admin",
      "/admin/agenda",
      "/admin/servicos",
      "/admin/clientes",
      "/admin/projetos",
      "/admin/orcamentos",
      "/admin/financeiro",
      "/admin/push",
      "/admin/notificacoes",
      "/admin/configuracoes",
    ];
    const timer = window.setTimeout(() => {
      for (const route of hotRoutes) {
        if (route !== pathname) {
          router.prefetch(route);
        }
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  // Bloqueia scroll de fundo e permite fechar com Escape quando o menu esquerdo está aberto
  useEffect(() => {
    if (!drawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerPathname(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  const togglePrivacy = async () => {
    const next = !hideValues;
    setHideValues(next);
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideFinancialValues: next }),
    }).catch(() => {});
    router.refresh();
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/MIMDAMIN");
    router.refresh();
  };

  const mobileDockItems: DockNavItem[] = [
    { key: "inicio", href: "/admin", label: "Início", icon: Home, exact: true },
    {
      key: "agenda",
      href: "/admin/agenda",
      label: "Agenda",
      icon: Calendar,
      exact: false,
    },
    {
      key: "clientes",
      href: "/admin/clientes",
      label: "Clientes",
      icon: Users,
      exact: false,
    },
    {
      key: "financeiro",
      href: "/admin/financeiro",
      label: "Financeiro",
      icon: Wallet,
      exact: false,
    },
    {
      key: "mais",
      label: "Mais",
      icon: LayoutGrid,
      onClick: () => setDrawerOpen((prev) => !prev),
      active: drawerOpen || isMoreRouteActive,
      badgeCount: unreadNotifications,
    },
  ];

  const roleLabel =
    user.role === "OWNER" ? "Proprietária" : "Administração";

  return (
    <div className="min-h-dvh flex bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <OneSignalUserSync userId={user.id} role={user.role} />
      <PushPromptModal userId={user.id} role={user.role} />
      {/* Sidebar Desktop Fixa e Recolhível */}
      <aside
        className={`hidden md:flex flex-col fixed inset-y-0 left-0 z-30 bg-[var(--bg-surface)] border-r border-[var(--border-default)] transition-[width] duration-200 ${
          collapsed ? "w-[68px]" : "w-[250px]"
        }`}
      >
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-[var(--border-default)]">
          {collapsed ? (
            <Link href="/admin" className="mx-auto">
              <BrandMonogramOnly size={28} />
            </Link>
          ) : (
            <BrandLogo href="/admin" compact />
          )}
          {!collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Recolher menu lateral"
              className="p-1.5 rounded-[6px] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
          ) : null}
        </div>

        {collapsed ? (
          <div className="px-2 pt-2">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expandir menu lateral"
              className="w-full h-9 flex items-center justify-center rounded-[6px] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        ) : null}

        <SidebarNavGroups
          collapsed={collapsed}
          isActive={isActive}
          unreadNotifications={unreadNotifications}
        />

        <div className="border-t border-[var(--border-default)] p-2.5 space-y-1.5">
          <Link
            href="/"
            className={`flex items-center gap-2 h-8 px-2.5 rounded-[6px] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <Globe className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            {!collapsed ? <span>Portal Público</span> : null}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={`w-full flex items-center gap-2 h-8 px-2.5 rounded-[6px] text-xs text-[var(--text-secondary)] hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger)] cursor-pointer ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            {!collapsed ? (
              <span>{loggingOut ? "Saindo..." : "Sair"}</span>
            ) : null}
          </button>
        </div>
      </aside>

      {/* Backdrop da Barra Lateral Esquerda (Mobile) */}
      <div
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
        className={`md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          drawerOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Barra Lateral Esquerda Deslizante (aberta pelo botão Mais) */}
      <aside
        aria-label="Menu administrativo completo"
        aria-hidden={!drawerOpen}
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[310px] flex flex-col bg-[var(--bg-surface)]/95 backdrop-blur-2xl border-r border-[var(--border-strong)]/80 shadow-[24px_0_60px_rgba(0,0,0,0.58)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 border-b border-[var(--border-default)] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <BrandLogo href="/admin" compact />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Fechar menu lateral"
              className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-[0.94] transition-all cursor-pointer"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-[var(--bg-subtle)]/80 border border-[var(--border-default)]">
            <div className="h-9 w-9 rounded-full bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/35 flex items-center justify-center text-[var(--brand-champagne)] shrink-0">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {user.name}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] truncate">
                {roleLabel} • Estúdio ZANIMA
              </p>
            </div>
          </div>
        </div>

        <SidebarNavGroups
          collapsed={false}
          isActive={isActive}
          unreadNotifications={unreadNotifications}
          onNavigate={() => setDrawerOpen(false)}
        />

        <div className="border-t border-[var(--border-default)] p-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2 bg-[var(--bg-surface)]">
          <PushOptInButton
            userId={user.id}
            role={user.role}
            compact
            className="w-full justify-center"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={togglePrivacy}
              className="h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] text-xs font-medium text-[var(--text-primary)] active:scale-[0.97] transition-all cursor-pointer"
            >
              {hideValues ? (
                <EyeOff className="h-3.5 w-3.5" strokeWidth={1.6} />
              ) : (
                <Eye className="h-3.5 w-3.5" strokeWidth={1.6} />
              )}
              <span>{hideValues ? "Ocultos" : "Valores"}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleTheme(true)}
              className="h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] text-xs font-medium text-[var(--text-primary)] active:scale-[0.97] transition-all cursor-pointer"
            >
              {theme === "dark" ? (
                <Sun className="h-3.5 w-3.5" strokeWidth={1.6} />
              ) : (
                <Moon className="h-3.5 w-3.5" strokeWidth={1.6} />
              )}
              <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/"
              onClick={() => setDrawerOpen(false)}
              className="h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <Globe className="h-3.5 w-3.5" strokeWidth={1.6} />
              <span>Site Público</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] text-xs font-medium text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.6} />
              <span>{loggingOut ? "Saindo..." : "Sair"}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-200 ${
          collapsed ? "md:pl-[68px]" : "md:pl-[250px]"
        }`}
      >
        <header className="sticky top-0 z-20 h-14 bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-4 md:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden">
              <BrandLogo href="/admin" compact />
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">
                Painel Administrativo
              </span>
              <span>•</span>
              <span className="truncate">{user.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePrivacy}
              aria-label={
                hideValues
                  ? "Exibir valores financeiros"
                  : "Ocultar valores financeiros"
              }
              title={
                hideValues
                  ? "Exibir valores financeiros"
                  : "Ocultar valores financeiros"
              }
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-all active:scale-[0.94]"
            >
              {hideValues ? (
                <EyeOff className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={1.5} />
              )}
              <span className="hidden sm:inline">
                {hideValues ? "Ocultos" : "Valores"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => toggleTheme(true)}
              aria-label="Alternar tema claro ou escuro"
              title="Alternar tema"
              className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-all active:scale-[0.94]"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>

            <Link
              href="/admin/notificacoes"
              aria-label="Notificações"
              className="relative h-9 w-9 inline-flex items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-all active:scale-[0.94]"
            >
              <Bell className="h-4 w-4" strokeWidth={1.5} />
              {unreadNotifications > 0 ? (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-[2px] bg-[var(--status-warning)]" />
              ) : null}
            </Link>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1380px] mx-auto px-4 md:px-6 py-5 pb-24 md:pb-8">
          {children}
        </main>

        <footer className="hidden md:flex items-center justify-between px-6 py-3 border-t border-[var(--border-default)] bg-[var(--bg-surface)]">
          <PconSignature />
          <span className="text-[11px] text-[var(--text-secondary)]">
            Horário oficial: America/Sao_Paulo • BRL
          </span>
        </footer>
      </div>

      <MobileFloatingDock
        items={mobileDockItems}
        isActive={isActive}
        ariaLabel="Navegação administrativa mobile"
      />
    </div>
  );
}
