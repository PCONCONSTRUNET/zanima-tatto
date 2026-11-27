"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Menu, Moon, Sun, X } from "lucide-react";
import { BrandLogo, PconSignature } from "@/components/brand-mark";
import { useTheme } from "@/components/theme-provider";

const PUBLIC_LINKS = [
  { href: "/", label: "Início" },
  { href: "/portfolio", label: "Portfólio" },
  { href: "/desenhos-disponiveis", label: "Desenhos" },
  { href: "/cuidados", label: "Cuidados & FAQ" },
  { href: "/orcamento", label: "Orçamento" },
  { href: "/agendar", label: "Agendar" },
];

export function PublicHeader({
  isLoggedIn,
  isAdmin,
}: {
  isLoggedIn: boolean;
  isAdmin: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-[var(--bg-surface)] border-b border-[var(--border-default)]">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        <BrandLogo href="/" />

        <nav className="hidden lg:flex items-center gap-6">
          {PUBLIC_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs font-medium tracking-[0.02em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleTheme(false)}
            aria-label="Alternar tema"
            className="h-9 w-9 inline-flex items-center justify-center rounded-[6px] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <Moon className="h-4 w-4" strokeWidth={1.5} />
            )}
          </button>

          <Link
            href={isLoggedIn ? (isAdmin ? "/admin" : "/minha-conta") : "/entrar"}
            className="hidden sm:inline-flex items-center justify-center h-9 px-3.5 rounded-[6px] bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-medium hover:bg-[var(--action-primary-hover)]"
          >
            {isLoggedIn
              ? isAdmin
                ? "Painel Admin"
                : "Minha Conta"
              : "Entrar / Cadastro"}
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
            className="lg:hidden h-9 w-9 inline-flex items-center justify-center rounded-[6px] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
          >
            {menuOpen ? (
              <X className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <Menu className="h-4 w-4" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="lg:hidden border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-4 space-y-2">
          {PUBLIC_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="block py-2 text-sm font-medium text-[var(--text-primary)] border-b border-[var(--border-default)]/50"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={isLoggedIn ? (isAdmin ? "/admin" : "/minha-conta") : "/entrar"}
            onClick={() => setMenuOpen(false)}
            className="block mt-2 py-2.5 text-center rounded-[6px] bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-sm font-medium"
          >
            {isLoggedIn
              ? isAdmin
                ? "Acessar Painel Admin"
                : "Acessar Minha Conta"
              : "Entrar ou Cadastrar"}
          </Link>
        </div>
      ) : null}
    </header>
  );
}

export function PublicFooter({
  instagramHandle,
  whatsappNumber,
  cityState,
}: {
  instagramHandle: string;
  whatsappNumber: string;
  cityState: string;
}) {
  const cleanWa = whatsappNumber.replace(/\D/g, "");
  return (
    <footer className="border-t border-[var(--border-default)] bg-[var(--bg-surface)] mt-12">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 grid grid-cols-1 md:grid-cols-4 gap-8 text-xs">
        <div className="md:col-span-2 space-y-3">
          <BrandLogo href="/" />
          <p className="text-[var(--text-secondary)] max-w-sm leading-relaxed">
            Estúdio autoral administrado por Leticia Zanini Macalossi, especializado em tatuagens Fine Line, Floral e Minimalista.
          </p>
          <p className="text-[var(--text-secondary)]">{cityState}</p>
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-[var(--text-primary)] uppercase tracking-[0.06em] text-[11px]">
            Navegação
          </p>
          <ul className="space-y-1.5 text-[var(--text-secondary)]">
            <li>
              <Link href="/portfolio" className="hover:text-[var(--text-primary)]">
                Portfólio autorizado
              </Link>
            </li>
            <li>
              <Link href="/orcamento" className="hover:text-[var(--text-primary)]">
                Solicitar orçamento
              </Link>
            </li>
            <li>
              <Link href="/agendar" className="hover:text-[var(--text-primary)]">
                Agendamento online
              </Link>
            </li>
            <li>
              <Link href="/cuidados" className="hover:text-[var(--text-primary)]">
                Cuidados e FAQ
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-[var(--text-primary)] uppercase tracking-[0.06em] text-[11px]">
            Contato & Privacidade
          </p>
          <ul className="space-y-1.5 text-[var(--text-secondary)]">
            <li>
              <a
                href={`https://instagram.com/${instagramHandle.replace("@", "")}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-[var(--text-primary)]"
              >
                Instagram {instagramHandle}
              </a>
            </li>
            {cleanWa ? (
              <li>
                <a
                  href={`https://wa.me/${cleanWa}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--text-primary)]"
                >
                  Atendimento pelo WhatsApp
                </a>
              </li>
            ) : null}
            <li>
              <Link href="/termos" className="hover:text-[var(--text-primary)]">
                Termos de Uso
              </Link>
            </li>
            <li>
              <Link href="/privacidade" className="hover:text-[var(--text-primary)]">
                Privacidade & LGPD
              </Link>
            </li>
            <li>
              <Link href="/entrar" className="hover:text-[var(--text-primary)]">
                Área do Cliente / Login
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--border-default)] py-4 px-4 md:px-6 max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <PconSignature />
        <span className="text-[11px] text-[var(--text-secondary)]">
          © {new Date().getFullYear()} ZANIMA TATTOO
        </span>
      </div>
    </footer>
  );
}
