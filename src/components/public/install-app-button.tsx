"use client";

import Link from "next/link";
import { Smartphone } from "lucide-react";

export function InstallAppButton({
  dark = false,
  onClick,
}: {
  dark?: boolean;
  onClick?: () => void;
}) {
  const className = `h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full border text-xs font-medium transition-all active:scale-[0.96] cursor-pointer ${
    dark
      ? "border-white/15 bg-white/8 text-white/90 hover:bg-white/14"
      : "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <Smartphone className="h-3.5 w-3.5" strokeWidth={1.6} />
        Instalar App
      </button>
    );
  }

  return (
    <Link href="/instalar" className={className}>
      <Smartphone className="h-3.5 w-3.5" strokeWidth={1.6} />
      Instalar App
    </Link>
  );
}
