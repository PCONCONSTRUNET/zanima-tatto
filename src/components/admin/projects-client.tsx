"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";
import { formatBRL } from "@/lib/format";
import {
  PROJECT_STAGE_LABELS,
  PROJECT_STAGE_ORDER,
  TATTOO_STYLES,
} from "@/lib/domain-labels";
import {
  Button,
  CurrencyInput,
  EmptyState,
  Field,
  Input,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";

type ProjectRow = {
  id: string;
  name: string;
  clientName: string;
  style: string;
  bodyRegion: string;
  approxSizeCm: string;
  stage: string;
  negotiatedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  plannedSessions: number;
  appointmentsCount: number;
};

export function ProjectsListClient({
  initialProjects,
  clients,
}: {
  initialProjects: ProjectRow[];
  clients: Array<{ id: string; fullName: string }>;
}) {
  const router = useRouter();
  const [stageFilter, setStageFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);

  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<string>(TATTOO_STYLES[0]);
  const [bodyRegion, setBodyRegion] = useState("");
  const [approxSizeCm, setApproxSizeCm] = useState("");
  const [negotiatedAmount, setNegotiatedAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [plannedSessions, setPlannedSessions] = useState(1);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (stageFilter === "ALL") return initialProjects;
    return initialProjects.filter((p) => p.stage === stageFilter);
  }, [initialProjects, stageFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          name,
          description,
          style,
          bodyRegion,
          approxSizeCm,
          negotiatedAmount: Number(negotiatedAmount || 0),
          depositAmount: Number(depositAmount || 0),
          plannedSessions: Number(plannedSessions || 1),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreateOpen(false);
        router.push(`/admin/projetos/${data.project.id}`);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">
            Projetos de Tatuagem
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Acompanhamento completo de criação, sessões, saldo financeiro e cicatrização.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Novo projeto
        </Button>
      </div>

      {/* Filtro por Etapa */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setStageFilter("ALL")}
          className={`h-8 px-3 rounded-[4px] text-xs font-medium whitespace-nowrap border cursor-pointer ${
            stageFilter === "ALL"
              ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
              : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]"
          }`}
        >
          Todos ({initialProjects.length})
        </button>
        {PROJECT_STAGE_ORDER.map((stage) => (
          <button
            key={stage}
            type="button"
            onClick={() => setStageFilter(stage)}
            className={`h-8 px-3 rounded-[4px] text-xs font-medium whitespace-nowrap border cursor-pointer ${
              stageFilter === stage
                ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]"
            }`}
          >
            {PROJECT_STAGE_LABELS[stage]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" strokeWidth={1.5} />}
          title="Nenhum projeto nesta etapa"
          description="Crie um projeto artístico ou converta um orçamento aprovado."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Criar projeto
            </Button>
          }
        />
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] divide-y divide-[var(--border-default)]">
          {filtered.map((p) => {
            const stepIndex = PROJECT_STAGE_ORDER.indexOf(
              p.stage as (typeof PROJECT_STAGE_ORDER)[number]
            );
            const pct =
              stepIndex >= 0
                ? Math.round(((stepIndex + 1) / PROJECT_STAGE_ORDER.length) * 100)
                : 10;
            return (
              <Link
                key={p.id}
                href={`/admin/projetos/${p.id}`}
                className="block p-4 hover:bg-[var(--bg-subtle)] transition-colors space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {p.clientName} • {p.style} • {p.bodyRegion} ({p.approxSizeCm})
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                      Restante: <strong className="text-[var(--text-primary)]">{formatBRL(p.remainingAmount)}</strong>
                    </span>
                    <StatusBadge
                      label={PROJECT_STAGE_LABELS[p.stage] || p.stage}
                      tone={p.stage === "COMPLETED" ? "success" : "info"}
                    />
                  </div>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-subtle)] rounded-[2px] overflow-hidden">
                  <div
                    className="h-full bg-[var(--action-primary)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-h-[88dvh] md:max-w-lg bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 rounded-t-[28px] md:rounded-3xl p-5 space-y-4 overflow-y-auto shadow-2xl"
          >
            <h3 className="font-display text-base font-semibold">
              Novo projeto de tatuagem
            </h3>
            <Field label="Cliente responsável">
              <Select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nome do projeto">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Ramo de lavanda Fine Line"
                required
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Estilo">
                <Select value={style} onChange={(e) => setStyle(e.target.value)}>
                  {TATTOO_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Região do corpo">
                <Input
                  value={bodyRegion}
                  onChange={(e) => setBodyRegion(e.target.value)}
                  placeholder="Ex: Antebraço"
                  required
                />
              </Field>
              <Field label="Tamanho aprox.">
                <Input
                  value={approxSizeCm}
                  onChange={(e) => setApproxSizeCm(e.target.value)}
                  placeholder="Ex: 12 cm"
                  required
                />
              </Field>
            </div>
            <Field label="Descrição artística">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Valor negociado">
                <CurrencyInput
                  value={negotiatedAmount}
                  onValueChange={setNegotiatedAmount}
                />
              </Field>
              <Field label="Sinal">
                <CurrencyInput
                  value={depositAmount}
                  onValueChange={setDepositAmount}
                />
              </Field>
              <Field label="Sessões prev.">
                <Input
                  type="number"
                  min={1}
                  value={plannedSessions}
                  onChange={(e) => setPlannedSessions(Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !clientId}>
                {saving ? "Criando..." : "Criar projeto"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
