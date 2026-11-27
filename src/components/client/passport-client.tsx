"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookHeart, Calendar, Feather, MapPin, Save } from "lucide-react";
import { formatDateBR } from "@/lib/format";
import { BrandMonogramOnly } from "@/components/brand-mark";
import { Button, EmptyState, Textarea } from "@/components/ui/primitives";

type PassportEntry = {
  id: string;
  projectId: string;
  title: string;
  completedDate: string;
  style: string;
  bodyRegion: string;
  clientMeaning: string;
  sessionsCount: number;
  careSummary: string;
  featuredFileId: string | null;
  touchUps: Array<{ date: string; notes: string; recordedBy?: string }>;
};

export function PassportClient({
  clientName,
  passports,
}: {
  clientName: string;
  passports: PassportEntry[];
}) {
  const router = useRouter();
  const [meanings, setMeanings] = useState<Record<string, string>>(
    Object.fromEntries(passports.map((p) => [p.id, p.clientMeaning]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const handleSaveMeaning = async (passportId: string) => {
    setSavingId(passportId);
    setSavedId(null);
    try {
      const res = await fetch("/api/client/passport", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passportId,
          clientMeaning: meanings[passportId] || "",
        }),
      });
      if (res.ok) {
        setSavedId(passportId);
        router.refresh();
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Cabeçalho Editorial e Emocional do Passaporte */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--brand-champagne)] font-semibold">
            <BookHeart className="h-3.5 w-3.5" strokeWidth={1.5} />
            Passaporte Digital da Tatuagem
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Minha História na Pele
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            Coleção pessoal de {clientName} no estúdio ZANIMA TATTOO — cada obra registrada com data, significado, sessões, cuidados e memória permanente.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-center px-4 py-3 rounded-[6px] bg-[var(--brand-champagne-subtle)] border border-[var(--border-default)]">
          <BrandMonogramOnly size={34} />
          <div className="text-xs">
            <p className="font-semibold tabular-nums text-[var(--text-primary)]">
              {passports.length} obra(s)
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Coleção ZANIMA
            </p>
          </div>
        </div>
      </section>

      {passports.length === 0 ? (
        <EmptyState
          icon={<BookHeart className="h-5 w-5" strokeWidth={1.5} />}
          title="Sua coleção começará aqui"
          description="Assim que um projeto artístico for concluído no estúdio, seu passaporte digital Minha História na Pele será emitido automaticamente."
          action={
            <Link
              href="/minha-conta/proxima-tattoo"
              className="h-9 px-4 inline-flex items-center rounded-[6px] bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-medium"
            >
              Planejar Minha Próxima Tattoo
            </Link>
          }
        />
      ) : (
        <div className="space-y-6 relative">
          {passports.map((p, index) => (
            <article
              key={p.id}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] overflow-hidden grid grid-cols-1 lg:grid-cols-12"
            >
              <div className="lg:col-span-5 bg-[var(--bg-subtle)] flex items-center justify-center min-h-[240px] border-b lg:border-b-0 lg:border-r border-[var(--border-default)]">
                {p.featuredFileId ? (
                  <img
                    src={`/api/files/${p.featuredFileId}`}
                    alt={p.title}
                    className="w-full h-full max-h-[380px] object-cover"
                  />
                ) : (
                  <div className="p-8 text-center space-y-2">
                    <BrandMonogramOnly size={44} />
                    <p className="text-xs text-[var(--text-secondary)]">
                      Fotografia ainda não anexada ao registro
                    </p>
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 p-6 sm:p-7 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--brand-champagne)] font-semibold">
                      Registro #{String(passports.length - index).padStart(2, "0")}
                    </p>
                    <h2 className="font-display text-xl font-semibold mt-0.5">
                      {p.title}
                    </h2>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                    {formatDateBR(p.completedDate)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 rounded-[6px] bg-[var(--bg-subtle)] text-xs">
                  <div className="flex items-center gap-1.5">
                    <Feather className="h-3.5 w-3.5 text-[var(--brand-champagne)]" strokeWidth={1.5} />
                    <span>{p.style}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[var(--brand-champagne)]" strokeWidth={1.5} />
                    <span>{p.bodyRegion}</span>
                  </div>
                  <div className="flex items-center gap-1.5 tabular-nums">
                    <Calendar className="h-3.5 w-3.5 text-[var(--brand-champagne)]" strokeWidth={1.5} />
                    <span>{p.sessionsCount} sessão(ões)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-[var(--text-primary)]">
                    Significado pessoal desta tatuagem
                  </label>
                  <Textarea
                    value={meanings[p.id] || ""}
                    onChange={(e) =>
                      setMeanings((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    placeholder="Escreva a história, lembrança ou símbolo que essa arte representa para você..."
                    className="min-h-[80px]"
                  />
                  <div className="flex items-center justify-between gap-2">
                    {savedId === p.id ? (
                      <span className="text-[11px] text-[var(--status-success)]">
                        Significado salvo no seu passaporte.
                      </span>
                    ) : (
                      <span />
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSaveMeaning(p.id)}
                      disabled={savingId === p.id}
                    >
                      <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {savingId === p.id ? "Salvando..." : "Salvar memória"}
                    </Button>
                  </div>
                </div>

                {p.careSummary ? (
                  <div className="p-3 rounded-[6px] border border-[var(--border-default)] text-xs space-y-1">
                    <p className="font-semibold">Orientações de cuidados registradas</p>
                    <p className="text-[var(--text-secondary)]">{p.careSummary}</p>
                  </div>
                ) : null}

                {p.touchUps.length > 0 ? (
                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold">Histórico de retoques</p>
                    <ul className="space-y-1 text-[var(--text-secondary)]">
                      {p.touchUps.map((tu, idx) => (
                        <li key={idx}>
                          <span className="tabular-nums font-medium">
                            {formatDateBR(tu.date)}:
                          </span>{" "}
                          {tu.notes}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
