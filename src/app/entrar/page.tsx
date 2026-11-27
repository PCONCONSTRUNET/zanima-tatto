"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandLogo, PconSignature } from "@/components/brand-mark";
import { LoginForm } from "@/components/public/public-sheet-content";

function LoginFormWithSearch() {
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "";
  return <LoginForm nextUrl={nextUrl} />;
}

export default function EntrarPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--bg-canvas)] px-4 py-5">
      <div className="max-w-sm w-full mx-auto">
        <Link
          href="/"
          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-all active:scale-[0.96]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.6} />
          Voltar
        </Link>
      </div>

      <div className="ios-page-enter max-w-sm w-full mx-auto my-6 bg-[var(--bg-surface)] border border-white/10 rounded-[32px] p-5 pt-3 sm:p-6 space-y-5 shadow-2xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-[var(--border-strong)] sm:hidden" />

        <div className="space-y-1.5">
          <BrandLogo href="/" compact />
          <h1 className="font-display text-lg font-semibold text-[var(--text-primary)] pt-2">
            Acessar minha conta
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Entre para acompanhar projetos e agendamentos.
          </p>
        </div>

        <Suspense fallback={<div className="text-xs text-[var(--text-secondary)]">Carregando...</div>}>
          <LoginFormWithSearch />
        </Suspense>
      </div>

      <div className="text-center">
        <PconSignature />
      </div>
    </div>
  );
}
