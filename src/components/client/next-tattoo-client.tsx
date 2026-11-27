"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { formatDateBR } from "@/lib/format";
import { TATTOO_STYLES } from "@/lib/domain-labels";
import {
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";

type IdeaItem = {
  id: string;
  title: string;
  description: string;
  style: string;
  bodyRegion: string | null;
  approxSizeCm: string | null;
  referenceFileIds: string[];
  convertedQuoteId: string | null;
  createdAt: string;
};

export function NextTattooClient({
  initialIdeas,
}: {
  initialIdeas: IdeaItem[];
}) {
  const router = useRouter();
  const [ideas, setIdeas] = useState(initialIdeas);
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [style, setStyle] = useState<string>(TATTOO_STYLES[0]);
  const [bodyRegion, setBodyRegion] = useState("");
  const [approxSizeCm, setApproxSizeCm] = useState("");
  const [description, setDescription] = useState("");
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setFileIds((prev) => [...prev, data.file.id]);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/client/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          style,
          bodyRegion: bodyRegion || undefined,
          approxSizeCm: approxSizeCm || undefined,
          description,
          referenceFileIds: fileIds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setIdeas((prev) => [data.idea, ...prev]);
        setCreateOpen(false);
        setTitle("");
        setDescription("");
        setFileIds([]);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRequestQuote = async (ideaId: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/client/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_quote", ideaId }),
      });
      if (res.ok) {
        const data = await res.json();
        setIdeas((prev) =>
          prev.map((i) =>
            i.id === ideaId ? { ...i, convertedQuoteId: data.quote.id } : i
          )
        );
        setFeedback("Orçamento enviado ao estúdio com suas referências!");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/client/ideas?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setIdeas((prev) => prev.filter((i) => i.id !== id));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--brand-champagne)] font-semibold">
            Inspirações
          </p>
          <h1 className="font-display text-2xl font-semibold mt-0.5">
            Minha Próxima Tattoo
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Salve referências e transforme ideias em orçamento quando estiver pronto(a).
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Nova inspiração
        </Button>
      </div>

      {feedback ? (
        <div className="p-3 rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success)] text-xs font-medium">
          {feedback}
        </div>
      ) : null}

      {ideas.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" strokeWidth={1.5} />}
          title="Nenhuma ideia salva ainda"
          description="Guarde referências visuais e anotações de projetos futuros para conversar com Leticia no momento certo."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Salvar primeira ideia
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ideas.map((idea) => (
            <div
              key={idea.id}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold">
                    {idea.title}
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {idea.style}
                    {idea.bodyRegion ? ` • ${idea.bodyRegion}` : ""}
                    {idea.approxSizeCm ? ` (${idea.approxSizeCm})` : ""}
                  </p>
                </div>
                <span className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                  {formatDateBR(idea.createdAt)}
                </span>
              </div>

              <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                {idea.description}
              </p>

              {idea.referenceFileIds.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto">
                  {idea.referenceFileIds.map((fid) => (
                    <img
                      key={fid}
                      src={`/api/files/${fid}`}
                      alt="Inspiração"
                      className="h-20 w-20 object-cover rounded-[6px] border border-[var(--border-default)] shrink-0"
                    />
                  ))}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-default)]">
                {idea.convertedQuoteId ? (
                  <StatusBadge label="Orçamento solicitado" tone="success" />
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleRequestQuote(idea.id)}
                    disabled={saving}
                  >
                    <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Solicitar orçamento desta ideia
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(idea.id)}
                  className="p-1.5 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] rounded-[4px] cursor-pointer"
                  aria-label="Excluir inspiração"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-h-[88dvh] md:max-w-lg bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 rounded-t-[28px] md:rounded-3xl p-5 space-y-4 shadow-2xl overflow-y-auto"
          >
            <h3 className="font-display text-base font-semibold">
              Salvar nova ideia de tatuagem
            </h3>
            <Field label="Nome da ideia">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Lírios minimalistas nas costas"
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
              <Field label="Região (opcional)">
                <Input
                  value={bodyRegion}
                  onChange={(e) => setBodyRegion(e.target.value)}
                />
              </Field>
              <Field label="Tamanho (opcional)">
                <Input
                  value={approxSizeCm}
                  onChange={(e) => setApproxSizeCm(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Descrição e referências">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </Field>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 h-9 px-3 rounded-[6px] border border-[var(--border-default)] text-xs font-medium cursor-pointer hover:bg-[var(--bg-subtle)]">
                <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                {uploading ? "Enviando..." : "Adicionar imagem de referência"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleUpload}
                />
              </label>
              {fileIds.length > 0 ? (
                <p className="text-[11px] text-[var(--status-success)]">
                  {fileIds.length} imagem(ns) anexada(s).
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar inspiração"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
