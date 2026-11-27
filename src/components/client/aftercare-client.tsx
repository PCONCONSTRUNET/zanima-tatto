"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Camera, Send } from "lucide-react";
import { formatDateTimeBR } from "@/lib/format";
import {
  Button,
  Field,
  Input,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";

type EntryItem = {
  id: string;
  dayNumber: number;
  clientObservation: string;
  artistFeedback: string | null;
  status: string;
  photoFileId: string | null;
  createdAt: string;
};

export function AftercareClient({
  project,
}: {
  project: {
    id: string;
    name: string;
    aftercareGuidance: string;
    entries: EntryItem[];
  };
}) {
  const router = useRouter();
  const [dayNumber, setDayNumber] = useState(3);
  const [observation, setObservation] = useState("");
  const [status, setStatus] = useState<
    "NORMAL" | "REVIEW_REQUESTED" | "TOUCHUP_REQUESTED"
  >("NORMAL");
  const [photoFileId, setPhotoFileId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    setUploading(true);
    try {
      const { compressImageFile } = await import("@/lib/image-compress");
      const file = await compressImageFile(rawFile);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("visibility", "CLIENT_OWNED");
      const res = await fetch("/api/files", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setPhotoFileId(data.file.id);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/client/aftercare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          dayNumber: Number(dayNumber),
          clientObservation: observation,
          status,
          photoFileId,
        }),
      });
      if (res.ok) {
        setObservation("");
        setPhotoFileId(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/minha-conta/minhas-tattoos"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Minhas tattoos
        </Link>
        <h1 className="font-display text-xl font-semibold">
          Acompanhamento Pós-Tatuagem — {project.name}
        </h1>
      </div>

      {/* Aviso obrigatório não-médico */}
      <div className="p-4 rounded-[8px] bg-[var(--status-warning-bg)] border border-[var(--status-warning)]/20 flex items-start gap-3 text-xs">
        <AlertTriangle
          className="h-4 w-4 text-[var(--status-warning)] shrink-0 mt-0.5"
          strokeWidth={1.5}
        />
        <div className="space-y-1">
          <p className="font-semibold text-[var(--text-primary)]">
            Importante: acompanhamento estético e orientativo (sem diagnóstico médico)
          </p>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            Este canal serve para registrar a evolução visual da cicatrização e solicitar avaliação ou retoque artístico. Em situações de dor intensa, secreção purulenta, febre, calor local excessivo ou suspeita de infecção ou alergia grave, procure atendimento médico ou serviço de saúde adequado imediatamente.
          </p>
        </div>
      </div>

      {project.aftercareGuidance ? (
        <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-4 space-y-1 text-xs">
          <p className="font-semibold text-[var(--text-primary)]">
            Orientações cadastradas pela tatuadora:
          </p>
          <p className="text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
            {project.aftercareGuidance}
          </p>
        </section>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-4"
      >
        <h2 className="font-display text-sm font-semibold">
          Registrar nova atualização
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Dia após o procedimento">
            <Input
              type="number"
              min={1}
              max={365}
              value={dayNumber}
              onChange={(e) => setDayNumber(Number(e.target.value))}
              required
            />
          </Field>
          <Field label="Finalidade do registro">
            <Select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value as
                    | "NORMAL"
                    | "REVIEW_REQUESTED"
                    | "TOUCHUP_REQUESTED"
                )
              }
            >
              <option value="NORMAL">Acompanhamento de rotina</option>
              <option value="REVIEW_REQUESTED">Solicitar avaliação da tatuadora</option>
              <option value="TOUCHUP_REQUESTED">Solicitar retoque</option>
            </Select>
          </Field>
        </div>

        <Field label="Como está a pele hoje?">
          <Textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Descreva descamação, sensibilidade ou dúvidas sobre os cuidados..."
            required
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 h-9 px-3 rounded-[6px] border border-[var(--border-default)] text-xs font-medium cursor-pointer hover:bg-[var(--bg-subtle)]">
            <Camera className="h-3.5 w-3.5" strokeWidth={1.5} />
            {uploading
              ? "Enviando foto..."
              : photoFileId
              ? "Foto anexada"
              : "Anexar foto atual"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </label>
          <Button type="submit" disabled={saving}>
            <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
            {saving ? "Enviando..." : "Enviar registro"}
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
          Histórico de evolução ({project.entries.length})
        </h2>
        {project.entries.map((entry) => (
          <div
            key={entry.id}
            className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-4 space-y-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                Dia {entry.dayNumber} • {formatDateTimeBR(entry.createdAt)}
              </span>
              <StatusBadge label={entry.status} />
            </div>
            <p className="text-[var(--text-primary)]">{entry.clientObservation}</p>
            {entry.photoFileId ? (
              <img
                src={`/api/files/${entry.photoFileId}`}
                alt="Foto de cicatrização"
                className="h-32 w-32 object-cover rounded-[6px] border border-[var(--border-default)]"
              />
            ) : null}
            {entry.artistFeedback ? (
              <div className="p-3 rounded-[6px] bg-[var(--bg-subtle)]">
                <strong>Retorno do estúdio:</strong> {entry.artistFeedback}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
