"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  PROJECT_STAGE_LABELS,
  PROJECT_STAGE_ORDER,
} from "@/lib/domain-labels";
import {
  Button,
  CurrencyInput,
  Field,
  Input,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";

type ProjectDetailProps = {
  project: {
    id: string;
    name: string;
    description: string;
    style: string;
    bodyRegion: string;
    approxSizeCm: string;
    stage: string;
    negotiatedAmount: number;
    depositAmount: number;
    paidTotal: number;
    remainingBalance: number;
    plannedSessions: number;
    aftercareGuidance: string;
    allowPublicPortfolio: boolean;
    hasSignedImageAuth: boolean;
    materialCost: number;
    client: { id: string; fullName: string; whatsapp: string };
    appointments: Array<{
      id: string;
      title: string;
      startAt: string;
      status: string;
      sessionNumber: number;
    }>;
    media: Array<{
      id: string;
      fileId: string;
      kind: string;
      caption: string | null;
      hasImageConsent: boolean;
      originalName: string;
    }>;
    aftercareEntries: Array<{
      id: string;
      dayNumber: number;
      clientObservation: string;
      artistFeedback: string | null;
      status: string;
      photoFileId: string | null;
      createdAt: string;
    }>;
    stockMovements: Array<{
      id: string;
      itemName: string;
      unit: string;
      quantity: number;
      cost: number;
    }>;
    hasPassport: boolean;
  };
};

const MEDIA_LABELS: Record<string, string> = {
  REFERENCE: "Referência",
  ARTWORK: "Desenho / Arte",
  RESULT_PHOTO: "Resultado",
  HEALING_PHOTO: "Cicatrização",
};

export function ProjectDetailClient({ project }: ProjectDetailProps) {
  const router = useRouter();
  const [stage, setStage] = useState(project.stage);
  const [negotiatedAmount, setNegotiatedAmount] = useState(
    String(project.negotiatedAmount)
  );
  const [depositAmount, setDepositAmount] = useState(
    String(project.depositAmount)
  );
  const [plannedSessions, setPlannedSessions] = useState(
    project.plannedSessions
  );
  const [aftercareGuidance, setAftercareGuidance] = useState(
    project.aftercareGuidance
  );
  const [allowPublicPortfolio, setAllowPublicPortfolio] = useState(
    project.allowPublicPortfolio
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Upload de mídia
  const [mediaKind, setMediaKind] = useState<
    "REFERENCE" | "ARTWORK" | "RESULT_PHOTO"
  >("ARTWORK");
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaConsent, setMediaConsent] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Feedback pós-tatuagem
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  // Pagamento rápido do projeto (sincroniza financeiro do estúdio + Pagamentos do cliente)
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(
    project.remainingBalance > 0 ? project.remainingBalance.toFixed(2) : ""
  );
  const [payKind, setPayKind] = useState<"DEPOSIT" | "PARTIAL" | "FULL">("PARTIAL");
  const [payMethod, setPayMethod] = useState("PIX");
  const [payStatus, setPayStatus] = useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [payNotes, setPayNotes] = useState("");
  const [paySaving, setPaySaving] = useState(false);

  const handleRegisterProjectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaySaving(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: project.client.id,
          projectId: project.id,
          kind: payKind,
          method: payMethod,
          amount: Number(payAmount),
          status: payStatus,
          notes: payNotes || `Pagamento — ${project.name}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao registrar pagamento.");
      } else {
        setPayModalOpen(false);
        setPayNotes("");
        setFeedback("Pagamento registrado e sincronizado na aba Pagamentos do cliente.");
        router.refresh();
      }
    } finally {
      setPaySaving(false);
    }
  };

  const currentStageIdx = PROJECT_STAGE_ORDER.indexOf(
    stage as (typeof PROJECT_STAGE_ORDER)[number]
  );

  const handleSave = async (nextStage?: string) => {
    const targetStage = nextStage ?? stage;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: targetStage,
          negotiatedAmount: Number(negotiatedAmount || 0),
          depositAmount: Number(depositAmount || 0),
          plannedSessions: Number(plannedSessions || 1),
          aftercareGuidance: aftercareGuidance || null,
          allowPublicPortfolio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível salvar.");
      } else {
        setStage(targetStage);
        setFeedback(
          targetStage === "COMPLETED"
            ? "Projeto salvo e Passaporte Digital Minha História na Pele atualizado."
            : "Projeto atualizado com sucesso."
        );
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    setUploading(true);
    setError(null);
    try {
      const { compressImageFile } = await import("@/lib/image-compress");
      const file = await compressImageFile(rawFile);
      const fd = new FormData();
      fd.append("file", file);
      fd.append(
        "visibility",
        allowPublicPortfolio && mediaConsent && mediaKind === "RESULT_PHOTO"
          ? "PUBLIC_PORTFOLIO"
          : "CLIENT_OWNED"
      );
      fd.append("clientId", project.client.id);

      const uploadRes = await fetch("/api/files", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setError(uploadData.error || "Erro ao enviar imagem.");
        return;
      }

      const attachRes = await fetch(`/api/admin/projects/${project.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_media",
          fileId: uploadData.file.id,
          kind: mediaKind,
          caption: mediaCaption || undefined,
          isClientVisible: true,
          hasImageConsent: mediaConsent,
        }),
      });
      if (attachRes.ok) {
        setMediaCaption("");
        router.refresh();
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleAftercareReply = async (
    entryId: string,
    status: "NORMAL" | "TOUCHUP_REQUESTED" | "MEDICAL_ADVISED"
  ) => {
    const text = replyText[entryId];
    if (!text?.trim()) return;
    const res = await fetch(`/api/admin/projects/${project.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "aftercare_feedback",
        entryId,
        artistFeedback: text,
        status,
      }),
    });
    if (res.ok) {
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/projetos"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            Todos os projetos
          </Link>
          <h1 className="font-display text-xl font-semibold">{project.name}</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Cliente:{" "}
            <Link
              href={`/admin/clientes/${project.client.id}`}
              className="underline hover:text-[var(--text-primary)]"
            >
              {project.client.fullName}
            </Link>{" "}
            • {project.style} • {project.bodyRegion} ({project.approxSizeCm})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {project.hasPassport ? (
            <StatusBadge label="Passaporte digital ativo" tone="success" />
          ) : null}
          <StatusBadge
            label={PROJECT_STAGE_LABELS[stage] || stage}
            tone={stage === "COMPLETED" ? "success" : "info"}
          />
        </div>
      </div>

      {error ? (
        <div className="p-3 rounded-[6px] bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div className="p-3 rounded-[6px] bg-[var(--status-success-bg)] text-[var(--status-success)] text-xs">
          {feedback}
        </div>
      ) : null}

      {/* Linha do Tempo Visual das 9 Etapas */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-4 space-y-3">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
          Linha do tempo artística (clique para avançar etapa)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-9 gap-1.5">
          {PROJECT_STAGE_ORDER.map((step, idx) => {
            const reached = idx <= currentStageIdx;
            const current = step === stage;
            return (
              <button
                key={step}
                type="button"
                disabled={saving}
                onClick={() => handleSave(step)}
                className={`p-2 rounded-[6px] border text-left transition-colors cursor-pointer ${
                  current
                    ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                    : reached
                    ? "bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-strong)]"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] opacity-80">
                  <span className="tabular-nums">{idx + 1}</span>
                  {reached ? <Check className="h-3 w-3" strokeWidth={2} /> : null}
                </div>
                <p className="text-[11px] font-medium mt-1 leading-tight">
                  {PROJECT_STAGE_LABELS[step]}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Esquerda: Especificações, Valores & Pós-Tatuagem */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold">
                Detalhes financeiros e técnicos
              </h2>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setPayModalOpen(true)}
              >
                Registrar pagamento
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-[6px] bg-[var(--bg-subtle)] text-xs">
              <div>
                <p className="text-[var(--text-secondary)]">Negociado</p>
                <p className="font-semibold tabular-nums">
                  {formatBRL(project.negotiatedAmount)}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-secondary)]">Pago</p>
                <p className="font-semibold tabular-nums text-[var(--status-success)]">
                  {formatBRL(project.paidTotal)}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-secondary)]">Saldo restante</p>
                <p className="font-semibold tabular-nums">
                  {formatBRL(project.remainingBalance)}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-secondary)]">Custo insumos</p>
                <p className="font-semibold tabular-nums">
                  {formatBRL(project.materialCost)}
                </p>
              </div>
            </div>

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
              <Field label="Sessões previstas">
                <Input
                  type="number"
                  min={1}
                  value={plannedSessions}
                  onChange={(e) => setPlannedSessions(Number(e.target.value))}
                />
              </Field>
            </div>

            <Field label="Orientações personalizadas de pós-tatuagem">
              <Textarea
                value={aftercareGuidance}
                onChange={(e) => setAftercareGuidance(e.target.value)}
                placeholder="Instruções específicas para este procedimento e região do corpo..."
              />
            </Field>

            <label className="flex items-start gap-2.5 p-3 rounded-[6px] bg-[var(--bg-subtle)] text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={allowPublicPortfolio}
                onChange={(e) => setAllowPublicPortfolio(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <span className="font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Autorizar exibição de fotos no Portfólio Público
                </span>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  {project.hasSignedImageAuth
                    ? "Cliente possui autorização de uso de imagem assinada."
                    : "Requer termo de autorização de imagem assinado ou consentimento marcado na foto de resultado."}
                </p>
              </div>
            </label>

            <Button onClick={() => handleSave()} disabled={saving}>
              <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
              {saving ? "Salvando..." : "Salvar alterações do projeto"}
            </Button>
          </div>

          {/* Acompanhamento Pós-Tatuagem */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
              <h2 className="font-display text-sm font-semibold">
                Evolução pós-tatuagem enviada pelo cliente ({project.aftercareEntries.length})
              </h2>
            </div>
            {project.aftercareEntries.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                O cliente ainda não enviou registros de cicatrização.
              </p>
            ) : (
              <div className="space-y-3">
                {project.aftercareEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-[6px] border border-[var(--border-default)] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        Dia {entry.dayNumber} pós-sessão
                      </span>
                      <StatusBadge label={entry.status} />
                    </div>
                    <p className="text-[var(--text-primary)]">
                      {entry.clientObservation}
                    </p>
                    {entry.photoFileId ? (
                      <img
                        src={`/api/files/${entry.photoFileId}`}
                        alt="Registro pós-tatuagem"
                        className="h-32 w-32 object-cover rounded-[6px] border border-[var(--border-default)]"
                      />
                    ) : null}
                    {entry.artistFeedback ? (
                      <p className="p-2 rounded-[4px] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                        <strong>Retorno do estúdio:</strong> {entry.artistFeedback}
                      </p>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <Input
                          placeholder="Registrar orientação (sem diagnóstico médico)..."
                          value={replyText[entry.id] || ""}
                          onChange={(e) =>
                            setReplyText((prev) => ({
                              ...prev,
                              [entry.id]: e.target.value,
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAftercareReply(entry.id, "NORMAL")}
                        >
                          Responder
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Direita: Mídias & Sessões */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-4">
            <h2 className="font-display text-sm font-semibold">
              Artes, referências e resultados ({project.media.length})
            </h2>

            <div className="p-3 rounded-[6px] bg-[var(--bg-subtle)] space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={mediaKind}
                  onChange={(e) =>
                    setMediaKind(
                      e.target.value as "REFERENCE" | "ARTWORK" | "RESULT_PHOTO"
                    )
                  }
                  className="h-9 text-xs"
                >
                  <option value="ARTWORK">Desenho / Arte</option>
                  <option value="REFERENCE">Referência</option>
                  <option value="RESULT_PHOTO">Foto do resultado</option>
                </Select>
                <Input
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  placeholder="Legenda opcional"
                  className="h-9 text-xs"
                />
              </div>
              <label className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={mediaConsent}
                  onChange={(e) => setMediaConsent(e.target.checked)}
                />
                Possui autorização de imagem para portfólio
              </label>
              <label className="inline-flex items-center gap-2 h-9 px-3 rounded-[6px] bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-medium cursor-pointer">
                <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                {uploading ? "Enviando..." : "Enviar arquivo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleUploadMedia}
                  disabled={uploading}
                />
              </label>
            </div>

            {project.media.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Nenhuma imagem anexada.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {project.media.map((m) => (
                  <div
                    key={m.id}
                    className="border border-[var(--border-default)] rounded-[6px] overflow-hidden"
                  >
                    <img
                      src={`/api/files/${m.fileId}`}
                      alt={m.caption || m.originalName}
                      className="h-32 w-full object-cover"
                    />
                    <div className="p-2 text-[11px] space-y-0.5">
                      <p className="font-medium truncate">
                        {MEDIA_LABELS[m.kind] || m.kind}
                      </p>
                      {m.caption ? (
                        <p className="text-[var(--text-secondary)] truncate">
                          {m.caption}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold">
              Sessões vinculadas ({project.appointments.length})
            </h2>
            {project.appointments.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Nenhuma sessão agendada ainda.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border-default)]">
                {project.appointments.map((a) => (
                  <li
                    key={a.id}
                    className="py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-medium">
                        Sessão {a.sessionNumber}: {a.title}
                      </p>
                      <p className="text-[var(--text-secondary)] tabular-nums">
                        {formatDateTimeBR(a.startAt)}
                      </p>
                    </div>
                    <StatusBadge
                      label={APPOINTMENT_STATUS_LABELS[a.status] || a.status}
                      tone={APPOINTMENT_STATUS_TONE[a.status] || "neutral"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {payModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleRegisterProjectPayment}
            className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 rounded-t-[28px] md:rounded-3xl p-5 space-y-3.5 shadow-2xl overflow-y-auto"
          >
            <h3 className="font-display text-base font-semibold">
              Registrar pagamento do projeto
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Valor">
                <CurrencyInput
                  value={payAmount}
                  onValueChange={setPayAmount}
                  required
                />
              </Field>
              <Field label="Tipo">
                <Select
                  value={payKind}
                  onChange={(e) =>
                    setPayKind(e.target.value as "DEPOSIT" | "PARTIAL" | "FULL")
                  }
                >
                  <option value="DEPOSIT">Sinal</option>
                  <option value="PARTIAL">Parcial</option>
                  <option value="FULL">Quitação integral</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Método">
                <Select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="PIX">Pix</option>
                  <option value="CREDIT_CARD">Cartão de crédito</option>
                  <option value="DEBIT_CARD">Cartão de débito</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="BANK_TRANSFER">Transferência</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  value={payStatus}
                  onChange={(e) =>
                    setPayStatus(e.target.value as "CONFIRMED" | "PENDING")
                  }
                >
                  <option value="CONFIRMED">Pago / Confirmado</option>
                  <option value="PENDING">Pendente / Em aberto</option>
                </Select>
              </Field>
            </div>
            <Field label="Observação (opcional)">
              <Input
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Ex: Sinal via Pix"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPayModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={paySaving}>
                {paySaving ? "Salvando..." : "Confirmar registro"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
