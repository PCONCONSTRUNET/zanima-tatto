"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Upload } from "lucide-react";
import { BrandLogo, PconSignature } from "@/components/brand-mark";
import { TATTOO_STYLES } from "@/lib/domain-labels";
import { compressImageFiles } from "@/lib/image-compress";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";

function OrcamentoForm() {
  const searchParams = useSearchParams();
  const presetIdea = searchParams.get("ideia") || "";

  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState(presetIdea);
  const [style, setStyle] = useState<string>(TATTOO_STYLES[0]);
  const [bodyRegion, setBodyRegion] = useState("");
  const [approxSizeCm, setApproxSizeCm] = useState("");
  const [availabilityText, setAvailabilityText] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("fullName", fullName);
      fd.append("whatsapp", whatsapp);
      fd.append("email", email);
      fd.append("title", title);
      fd.append("style", style);
      fd.append("bodyRegion", bodyRegion);
      fd.append("approxSizeCm", approxSizeCm);
      fd.append("availabilityText", availabilityText);
      fd.append("ideaDescription", ideaDescription);
      fd.append("clientNotes", clientNotes);
      if (files && files.length > 0) {
        const compressed = await compressImageFiles(files, 4);
        compressed.forEach((f) => fd.append("references", f));
      }

      const res = await fetch("/api/public/quotes", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível enviar o orçamento.");
        return;
      }
      setSubmittedId(data.quoteCode || data.quoteId);
    } catch {
      setError("Falha de conexão ao enviar solicitação.");
    } finally {
      setSaving(false);
    }
  };

  if (submittedId) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-8 text-center space-y-4">
        <CheckCircle2
          className="h-8 w-8 mx-auto text-[var(--status-success)]"
          strokeWidth={1.5}
        />
        <h2 className="font-display text-xl font-semibold">
          Solicitação enviada com sucesso
        </h2>
        <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
          Recebemos sua ideia (#{submittedId}). Leticia analisará os detalhes, referências e disponibilidade para responder com sua proposta personalizada.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link
            href="/cadastro"
            className="h-10 px-4 inline-flex items-center rounded-[6px] bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-medium"
          >
            Criar Área do Cliente para acompanhar
          </Link>
          <Link
            href="/"
            className="h-10 px-4 inline-flex items-center rounded-[6px] border border-[var(--border-default)] text-xs font-medium"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 sm:p-7 space-y-4"
    >
      {error ? (
        <div className="p-3 rounded-[6px] bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nome completo">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </Field>
        <Field label="WhatsApp">
          <Input
            type="tel"
            inputMode="tel"
            placeholder="(00) 90000-0000"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="E-mail (opcional)">
          <Input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Título da ideia">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Ramo botânico delicado"
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Estilo desejado">
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
            placeholder="Ex: Antebraço, costela..."
            required
          />
        </Field>
        <Field label="Tamanho aproximado">
          <Input
            value={approxSizeCm}
            onChange={(e) => setApproxSizeCm(e.target.value)}
            placeholder="Ex: 10 cm"
            required
          />
        </Field>
      </div>

      <Field label="Descreva sua ideia com detalhes">
        <Textarea
          value={ideaDescription}
          onChange={(e) => setIdeaDescription(e.target.value)}
          placeholder="Conte o significado, elementos desejados, traços ou adaptações..."
          required
        />
      </Field>

      <Field label="Disponibilidade de datas/turnos">
        <Input
          value={availabilityText}
          onChange={(e) => setAvailabilityText(e.target.value)}
          placeholder="Ex: Terças e quintas pela manhã ou sábados"
        />
      </Field>

      <Field
        label="Imagens de referência (até 4 arquivos JPG/PNG/WEBP)"
        hint="Envie referências visuais para apoiar o desenho autoral."
      >
        <label className="flex items-center gap-2 h-11 px-3 border border-dashed border-[var(--border-strong)] rounded-[6px] text-xs text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-subtle)]">
          <Upload className="h-4 w-4" strokeWidth={1.5} />
          {files && files.length > 0
            ? `${files.length} arquivo(s) selecionado(s)`
            : "Selecionar imagens de referência"}
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => setFiles(e.target.files)}
          />
        </label>
      </Field>

      <Field label="Observações adicionais (opcional)">
        <Textarea
          value={clientNotes}
          onChange={(e) => setClientNotes(e.target.value)}
          className="min-h-[72px]"
        />
      </Field>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Enviando solicitação..." : "Enviar solicitação de orçamento"}
      </Button>
    </form>
  );
}

export default function OrcamentoPublicoPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--bg-canvas)] px-4 py-6">
      <div className="max-w-2xl w-full mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Voltar ao estúdio
        </Link>
        <BrandLogo href="/" compact />
      </div>

      <div className="max-w-2xl w-full mx-auto my-8 space-y-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Orçamento personalizado
          </p>
          <h1 className="font-display text-2xl font-semibold mt-1">
            Conte sua ideia para Leticia Zanini
          </h1>
        </div>
        <Suspense fallback={<div className="text-xs text-[var(--text-secondary)]">Carregando formulário...</div>}>
          <OrcamentoForm />
        </Suspense>
      </div>

      <div className="text-center">
        <PconSignature />
      </div>
    </div>
  );
}
