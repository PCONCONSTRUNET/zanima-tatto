"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo, PconSignature } from "@/components/brand-mark";
import { SignupForm } from "@/components/public/public-sheet-content";

export default function CadastroPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--bg-canvas)] px-4 py-4">
      <div className="max-w-sm w-full mx-auto">
        <Link
          href="/"
          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-all active:scale-[0.96]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.6} />
          Voltar
        </Link>
      </div>

      <div className="ios-page-enter max-w-sm w-full mx-auto my-4 bg-[var(--bg-surface)] border border-white/10 rounded-[32px] p-5 pt-3 sm:p-6 space-y-4 shadow-2xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-[var(--border-strong)] sm:hidden" />

        <div className="space-y-1.5">
          <BrandLogo href="/" compact />
          <h1 className="font-display text-lg font-semibold text-[var(--text-primary)] pt-2">
            Criar conta
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Cadastro rápido de cliente
          </p>
        </div>

        <SignupForm />
      </div>

      <div className="text-center">
        <PconSignature />
      </div>
    </div>
  );
}
