"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Smartphone } from "lucide-react";
import { BrandLogo, PconSignature } from "@/components/brand-mark";
import { InstallGuideContent } from "@/components/public/public-sheet-content";

export default function InstalarPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--bg-canvas)] text-[var(--text-primary)] px-4 py-5">
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-all active:scale-[0.96]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Voltar
        </Link>
        <BrandLogo href="/" compact />
      </div>

      <main className="max-w-md w-full mx-auto my-6">
        <div className="ios-page-enter bg-[var(--bg-surface)] border border-white/10 rounded-[32px] p-5 pt-3 sm:p-6 space-y-4 shadow-2xl">
          <div className="mx-auto h-1 w-10 rounded-full bg-[var(--border-strong)] sm:hidden" />

          <div className="space-y-1.5 text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center justify-center">
              <Smartphone className="h-4 w-4 text-[var(--text-primary)]" strokeWidth={1.75} />
            </div>
            <h1 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Instalar App ZANIMA
            </h1>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Adicione o aplicativo na tela inicial do seu celular em segundos, sem ocupar memória.
            </p>
          </div>

          <InstallGuideContent />
        </div>
      </main>

      <footer className="text-center space-y-1.5">
        <div className="flex items-center justify-center gap-3 text-[11px] text-[var(--text-secondary)]">
          <Link href="/termos" className="hover:text-[var(--text-primary)]">
            Termos de Uso
          </Link>
          <span>•</span>
          <Link href="/privacidade" className="hover:text-[var(--text-primary)]">
            Política de Privacidade
          </Link>
        </div>
        <PconSignature />
      </footer>
    </div>
  );
}
