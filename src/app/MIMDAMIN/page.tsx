import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
import { getCurrentUser } from "@/lib/security/session";
import { BrandLogo } from "@/components/brand-mark";
import { LoginForm } from "@/components/public/public-sheet-content";

export const dynamic = "force-dynamic";

export default async function AdminPortalEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  if (user && (user.role === "OWNER" || user.role === "STAFF")) {
    redirect("/admin");
  }

  const params = await searchParams;
  const nextUrl =
    params.next && params.next.startsWith("/admin") ? params.next : "/admin";

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--bg-canvas)] text-[var(--text-primary)] px-4 py-5">
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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <BrandLogo href="/" compact />
            <span className="h-7 px-2.5 rounded-full bg-[var(--brand-champagne-subtle)] text-[var(--brand-champagne)] text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1">
              <Shield className="h-3 w-3" strokeWidth={1.75} />
              Admin
            </span>
          </div>
          <h1 className="font-display text-lg font-semibold text-[var(--text-primary)] pt-1">
            Painel Administrativo
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Acesso restrito para administração, agenda e financeiro do estúdio.
          </p>
        </div>

        <LoginForm nextUrl={nextUrl} adminMode />
      </div>

      <div className="h-4" aria-hidden="true" />
    </div>
  );
}
