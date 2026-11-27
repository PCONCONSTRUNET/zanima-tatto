"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, HeartPulse, Sparkles, X } from "lucide-react";
import { formatBRL, formatDateBR } from "@/lib/format";
import {
  PROJECT_STAGE_LABELS,
  PROJECT_STAGE_ORDER,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_TONE,
} from "@/lib/domain-labels";
import { Button, EmptyState, StatusBadge } from "@/components/ui/primitives";

type ProjectItem = {
  id: string;
  name: string;
  description: string;
  style: string;
  bodyRegion: string;
  approxSizeCm: string;
  stage: string;
  negotiatedAmount: number;
  paidAmount: number;
  aftercareGuidance: string | null;
  media: Array<{
    id: string;
    fileId: string;
    kind: string;
    caption: string | null;
  }>;
};

type QuoteItem = {
  id: string;
  title: string;
  style: string;
  bodyRegion: string;
  approxSizeCm: string;
  status: string;
  quotedAmount: number | null;
  depositAmount: number | null;
  paymentTerms: string | null;
  validUntil: string | null;
  adminNotes: string | null;
  createdAt: string;
};

export function ClientTattoosClient({
  projects,
  quotes,
}: {
  projects: ProjectItem[];
  quotes: QuoteItem[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleQuoteDecision = async (
    quoteId: string,
    decision: "APPROVED" | "DECLINED"
  ) => {
    setBusyId(quoteId);
    try {
      const res = await fetch("/api/client/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, decision }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">
            Minhas Tatuagens e Orçamentos
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Acompanhe cada etapa artística, aprove propostas e registre sua cicatrização.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/minha-conta/proxima-tattoo"
            className="h-9 px-3 inline-flex items-center rounded-[6px] border border-[var(--border-default)] text-xs font-medium hover:bg-[var(--bg-subtle)]"
          >
            Minha Próxima Tattoo
          </Link>
          <Link
            href="/minha-conta/minha-historia-na-pele"
            className="h-9 px-3 inline-flex items-center rounded-[6px] bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-medium"
          >
            Passaporte Digital
          </Link>
        </div>
      </div>

      {/* Orçamentos */}
      {quotes.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
            Orçamentos ({quotes.length})
          </h2>
          <div className="space-y-3">
            {quotes.map((q) => (
              <div
                key={q.id}
                className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{q.title}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {q.style} • {q.bodyRegion} ({q.approxSizeCm}) •{" "}
                      {formatDateBR(q.createdAt)}
                    </p>
                  </div>
                  <StatusBadge
                    label={QUOTE_STATUS_LABELS[q.status] || q.status}
                    tone={QUOTE_STATUS_TONE[q.status] || "neutral"}
                  />
                </div>

                {q.quotedAmount !== null ? (
                  <div className="p-3 rounded-[6px] bg-[var(--bg-subtle)] text-xs space-y-1">
                    <p>
                      <strong>Valor proposto:</strong>{" "}
                      <span className="tabular-nums">{formatBRL(q.quotedAmount)}</span>
                      {q.depositAmount !== null
                        ? ` • Sinal: ${formatBRL(q.depositAmount)}`
                        : ""}
                    </p>
                    {q.paymentTerms ? (
                      <p>
                        <strong>Condições:</strong> {q.paymentTerms}
                      </p>
                    ) : null}
                    {q.validUntil ? (
                      <p>
                        <strong>Validade:</strong> {formatDateBR(q.validUntil)}
                      </p>
                    ) : null}
                    {q.adminNotes ? (
                      <p className="text-[var(--text-secondary)]">{q.adminNotes}</p>
                    ) : null}
                  </div>
                ) : null}

                {q.status === "SENT" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleQuoteDecision(q.id, "APPROVED")}
                      disabled={busyId === q.id}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Aprovar orçamento
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleQuoteDecision(q.id, "DECLINED")}
                      disabled={busyId === q.id}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Recusar
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Projetos */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
          Meus projetos artísticos ({projects.length})
        </h2>
        {projects.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" strokeWidth={1.5} />}
            title="Nenhum projeto ativo ainda"
            description="Solicite um orçamento ou salve inspirações em Minha Próxima Tattoo."
            action={
              <Link
                href="/orcamento"
                className="h-9 px-4 inline-flex items-center rounded-[6px] bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-medium"
              >
                Solicitar orçamento
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {projects.map((p) => {
              const stepIdx = PROJECT_STAGE_ORDER.indexOf(
                p.stage as (typeof PROJECT_STAGE_ORDER)[number]
              );
              const pct =
                stepIdx >= 0
                  ? Math.round(((stepIdx + 1) / PROJECT_STAGE_ORDER.length) * 100)
                  : 10;
              return (
                <div
                  key={p.id}
                  className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-semibold">
                        {p.name}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {p.style} • {p.bodyRegion} ({p.approxSizeCm})
                      </p>
                    </div>
                    <StatusBadge
                      label={PROJECT_STAGE_LABELS[p.stage] || p.stage}
                      tone={p.stage === "COMPLETED" ? "success" : "info"}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
                      <span>Evolução do projeto</span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-subtle)] rounded-[2px] overflow-hidden">
                      <div
                        className="h-full bg-[var(--action-primary)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {p.media.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {p.media.map((m) => (
                        <img
                          key={m.id}
                          src={`/api/files/${m.fileId}`}
                          alt={m.caption || p.name}
                          className="h-24 w-24 object-cover rounded-[6px] border border-[var(--border-default)] shrink-0"
                        />
                      ))}
                    </div>
                  ) : null}

                  {p.aftercareGuidance ? (
                    <div className="p-3 rounded-[6px] bg-[var(--bg-subtle)] text-xs space-y-1">
                      <p className="font-semibold text-[var(--text-primary)]">
                        Orientações da tatuadora:
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        {p.aftercareGuidance}
                      </p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border-default)] text-xs">
                    <span className="text-[var(--text-secondary)] tabular-nums">
                      Pago: {formatBRL(p.paidAmount)} de{" "}
                      {formatBRL(p.negotiatedAmount)}
                    </span>
                    <Link
                      href={`/minha-conta/pos-tatuagem/${p.id}`}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-[var(--border-default)] font-medium hover:bg-[var(--bg-subtle)]"
                    >
                      <HeartPulse className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Acompanhamento pós-tatuagem
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
