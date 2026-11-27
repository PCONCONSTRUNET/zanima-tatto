"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  FolderPlus,
  Layers,
  Pencil,
  Plus,
  Repeat,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import {
  Button,
  ConfirmModal,
  CurrencyInput,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";

type ServiceItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  sessionsCount: number;
  price: number;
  depositAmount: number;
  isActive: boolean;
};

type CategoryItem = {
  id: string;
  name: string;
};

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function ServicesClient({
  initialServices,
  initialCategories,
}: {
  initialServices: ServiceItem[];
  initialCategories: CategoryItem[];
}) {
  const router = useRouter();
  const [services, setServices] = useState<ServiceItem[]>(initialServices);
  const [categories, setCategories] =
    useState<CategoryItem[]>(initialCategories);

  const [tab, setTab] = useState<"services" | "categories">("services");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Modal Criar/Editar Serviço
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(
    null
  );
  const [srvName, setSrvName] = useState("");
  const [srvCategory, setSrvCategory] = useState("");
  const [srvNewCategoryInput, setSrvNewCategoryInput] = useState("");
  const [srvDuration, setSrvDuration] = useState("120");
  const [srvSessionsCount, setSrvSessionsCount] = useState("1");
  const [srvPrice, setSrvPrice] = useState("0");
  const [srvDeposit, setSrvDeposit] = useState("0");
  const [srvDescription, setSrvDescription] = useState("");

  // Modal Criar Categoria
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [catName, setCatName] = useState("");

  // Confirmação exclusão
  const [deleteServiceTarget, setDeleteServiceTarget] =
    useState<ServiceItem | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] =
    useState<CategoryItem | null>(null);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allCategoryNames = useMemo(() => {
    const names = new Set<string>();
    categories.forEach((c) => {
      if (c.name.trim()) names.add(c.name.trim());
    });
    services.forEach((s) => {
      if (s.category.trim()) names.add(s.category.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categories, services]);

  const filteredServices = useMemo(() => {
    if (categoryFilter === "ALL") return services;
    if (categoryFilter === "UNCATEGORIZED") {
      return services.filter((s) => !s.category.trim());
    }
    return services.filter((s) => s.category.trim() === categoryFilter);
  }, [services, categoryFilter]);

  const openCreateService = () => {
    setEditingService(null);
    setSrvName("");
    setSrvCategory("");
    setSrvNewCategoryInput("");
    setSrvDuration("120");
    setSrvSessionsCount("1");
    setSrvPrice("0");
    setSrvDeposit("0");
    setSrvDescription("");
    setError(null);
    setServiceModalOpen(true);
  };

  const openEditService = (srv: ServiceItem) => {
    setEditingService(srv);
    setSrvName(srv.name);
    setSrvCategory(srv.category || "");
    setSrvNewCategoryInput("");
    setSrvDuration(String(srv.durationMinutes || 120));
    setSrvSessionsCount(String(srv.sessionsCount || 1));
    setSrvPrice(String(srv.price || 0));
    setSrvDeposit(String(srv.depositAmount || 0));
    setSrvDescription(srv.description || "");
    setError(null);
    setServiceModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const resolvedCategory =
        srvCategory === "__NEW__"
          ? srvNewCategoryInput.trim()
          : srvCategory.trim();

      if (srvCategory === "__NEW__" && resolvedCategory.length >= 2) {
        const catRes = await fetch("/api/admin/service-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: resolvedCategory }),
        });
        if (catRes.ok) {
          const catData = await catRes.json();
          if (catData.category) {
            setCategories((prev) =>
              prev.some((c) => c.id === catData.category.id)
                ? prev
                : [...prev, catData.category]
            );
          }
        }
      }

      const payload = {
        category: resolvedCategory,
        name: srvName.trim(),
        description: srvDescription.trim() || undefined,
        durationMinutes: Math.max(15, Math.min(720, Number(srvDuration) || 120)),
        sessionsCount: Math.max(1, Math.min(24, Number(srvSessionsCount) || 1)),
        price: Math.max(0, Number(srvPrice) || 0),
        depositAmount: Math.max(0, Number(srvDeposit) || 0),
      };

      const url = editingService
        ? `/api/admin/services/${editingService.id}`
        : "/api/admin/services";
      const method = editingService ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível salvar o serviço.");
        return;
      }

      if (editingService) {
        setServices((prev) =>
          prev.map((s) => (s.id === data.service.id ? data.service : s))
        );
        setFeedback("Serviço atualizado.");
      } else {
        setServices((prev) => [...prev, data.service]);
        setFeedback("Serviço adicionado ao catálogo.");
      }
      setServiceModalOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (srv: ServiceItem) => {
    const res = await fetch(`/api/admin/services/${srv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !srv.isActive }),
    });
    if (res.ok) {
      const data = await res.json();
      setServices((prev) =>
        prev.map((s) => (s.id === data.service.id ? data.service : s))
      );
      router.refresh();
    }
  };

  const handleConfirmDeleteService = async () => {
    if (!deleteServiceTarget) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/services/${deleteServiceTarget.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setServices((prev) =>
          prev.filter((s) => s.id !== deleteServiceTarget.id)
        );
        setFeedback("Serviço excluído.");
        setDeleteServiceTarget(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/service-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar categoria.");
        return;
      }
      if (data.category) {
        setCategories((prev) =>
          prev.some((c) => c.id === data.category.id)
            ? prev
            : [...prev, data.category]
        );
      }
      setCatName("");
      setCategoryModalOpen(false);
      setFeedback("Categoria salva.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/service-categories?id=${encodeURIComponent(deleteCategoryTarget.id)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setCategories((prev) =>
          prev.filter((c) => c.id !== deleteCategoryTarget.id)
        );
        setFeedback("Categoria removida.");
        setDeleteCategoryTarget(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-champagne)]">
            Catálogo do Estúdio
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Serviços
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Cadastre categorias e serviços opcionais com duração, valor e quantidade de sessões.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setCategoryModalOpen(true);
            }}
            className="h-9 px-3.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer"
          >
            <FolderPlus className="h-3.5 w-3.5 text-[var(--brand-champagne)]" />
            <span>Nova categoria</span>
          </button>

          <button
            type="button"
            onClick={openCreateService}
            className="h-9 px-4 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            <span>Novo serviço</span>
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback ? (
        <div className="px-4 py-2.5 rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success)] text-xs font-medium flex items-center justify-between">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="cursor-pointer opacity-70 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* Abas iOS: Serviços / Categorias */}
      <div className="flex p-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] max-w-xs">
        <button
          type="button"
          onClick={() => setTab("services")}
          className={`flex-1 h-8 rounded-full text-xs font-medium transition-all cursor-pointer ${
            tab === "services"
              ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] shadow-sm"
              : "text-[var(--text-secondary)]"
          }`}
        >
          Serviços ({services.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("categories")}
          className={`flex-1 h-8 rounded-full text-xs font-medium transition-all cursor-pointer ${
            tab === "categories"
              ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] shadow-sm"
              : "text-[var(--text-secondary)]"
          }`}
        >
          Categorias ({categories.length})
        </button>
      </div>

      {/* TAB: SERVIÇOS */}
      {tab === "services" ? (
        <div className="space-y-4">
          {allCategoryNames.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryFilter("ALL")}
                className={`h-8 px-3 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                  categoryFilter === "ALL"
                    ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]"
                }`}
              >
                Todos ({services.length})
              </button>
              {allCategoryNames.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`h-8 px-3 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                    categoryFilter === cat
                      ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                      : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
              {services.some((s) => !s.category.trim()) ? (
                <button
                  type="button"
                  onClick={() => setCategoryFilter("UNCATEGORIZED")}
                  className={`h-8 px-3 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                    categoryFilter === "UNCATEGORIZED"
                      ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                      : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]"
                  }`}
                >
                  Sem categoria
                </button>
              ) : null}
            </div>
          ) : null}

          {filteredServices.length === 0 ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-6">
              <EmptyState
                icon={<Sparkles className="h-5 w-5" strokeWidth={1.5} />}
                title="Nenhum serviço cadastrado ainda"
                description="Crie serviços com minutagem, valor opcional e quantidade de sessões."
                action={
                  <Button type="button" size="sm" onClick={openCreateService}>
                    + Novo serviço
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-default)] divide-y divide-[var(--border-default)] overflow-hidden">
              {filteredServices.map((srv) => (
                <div
                  key={srv.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-opacity ${
                    srv.isActive ? "" : "opacity-55"
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {srv.category.trim() ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--brand-champagne-subtle)] text-[var(--brand-champagne)] text-[10px] font-semibold uppercase tracking-wide">
                          <Tag className="h-2.5 w-2.5" />
                          {srv.category}
                        </span>
                      ) : null}
                      {srv.sessionsCount > 1 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--status-warning-bg)] text-[var(--status-warning)] text-[10px] font-semibold">
                          <Repeat className="h-2.5 w-2.5" />
                          {srv.sessionsCount} sessões
                        </span>
                      ) : null}
                      {!srv.isActive ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--bg-canvas)] text-[var(--text-muted)] text-[10px] font-medium">
                          Pausado
                        </span>
                      ) : null}
                    </div>

                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {srv.name}
                    </p>

                    {srv.description ? (
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {srv.description}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)] tabular-nums pt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-[var(--text-muted)]" />
                        {formatDuration(srv.durationMinutes)}
                      </span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {srv.price > 0
                          ? formatBRL(srv.price)
                          : "Valor a definir"}
                      </span>
                      {srv.depositAmount > 0 ? (
                        <span>Sinal {formatBRL(srv.depositAmount)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(srv)}
                      className={`h-8 px-3 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                        srv.isActive
                          ? "bg-[var(--status-success-bg)] border-transparent text-[var(--status-success)]"
                          : "bg-[var(--bg-canvas)] border-[var(--border-default)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {srv.isActive ? "Ativo" : "Ativar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditService(srv)}
                      aria-label={`Editar ${srv.name}`}
                      className="h-8 w-8 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteServiceTarget(srv)}
                      aria-label={`Excluir ${srv.name}`}
                      className="h-8 w-8 rounded-full bg-[var(--status-danger-bg)] inline-flex items-center justify-center text-[var(--status-danger)] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* TAB: CATEGORIAS (OPCIONAIS) */}
      {tab === "categories" ? (
        <div className="space-y-4">
          {categories.length === 0 ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-6">
              <EmptyState
                icon={<Layers className="h-5 w-5" strokeWidth={1.5} />}
                title="Nenhuma categoria criada ainda"
                description="Categorias são opcionais e ajudam a organizar o catálogo (ex.: Fine Line, Fechamento)."
                action={
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCategoryModalOpen(true)}
                  >
                    + Nova categoria
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-default)] divide-y divide-[var(--border-default)] overflow-hidden">
              {categories.map((cat) => {
                const count = services.filter(
                  (s) => s.category.trim().toLowerCase() === cat.name.trim().toLowerCase()
                ).length;
                return (
                  <div
                    key={cat.id}
                    className="px-4 py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-8 w-8 rounded-full bg-[var(--brand-champagne-subtle)] text-[var(--brand-champagne)] flex items-center justify-center shrink-0">
                        <Tag className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {cat.name}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {count}{" "}
                          {count === 1
                            ? "serviço vinculado"
                            : "serviços vinculados"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeleteCategoryTarget(cat)}
                      aria-label={`Remover categoria ${cat.name}`}
                      className="h-8 w-8 rounded-full bg-[var(--status-danger-bg)] inline-flex items-center justify-center text-[var(--status-danger)] cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* MODAL CRIAR / EDITAR SERVIÇO */}
      {serviceModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/65 backdrop-blur-xs p-0 md:p-4">
          <form
            onSubmit={handleSaveService}
            className="w-full max-h-[88dvh] md:max-w-lg rounded-t-[28px] md:rounded-3xl bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 p-5 space-y-4 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">
                {editingService ? "Editar serviço" : "Novo serviço"}
              </h2>
              <button
                type="button"
                onClick={() => setServiceModalOpen(false)}
                className="h-8 w-8 rounded-full bg-[var(--bg-canvas)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error ? (
              <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs font-medium">
                {error}
              </div>
            ) : null}

            <Field label="Nome do serviço *">
              <Input
                value={srvName}
                onChange={(e) => setSrvName(e.target.value)}
                placeholder="Ex.: Fechamento de braço / Fine Line 8cm"
                required
              />
            </Field>

            <Field label="Categoria (opcional)">
              <Select
                value={srvCategory}
                onChange={(e) => setSrvCategory(e.target.value)}
              >
                <option value="">Sem categoria (opcional)</option>
                {allCategoryNames.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__NEW__">+ Criar nova categoria...</option>
              </Select>
            </Field>

            {srvCategory === "__NEW__" ? (
              <Field label="Nome da nova categoria">
                <Input
                  value={srvNewCategoryInput}
                  onChange={(e) => setSrvNewCategoryInput(e.target.value)}
                  placeholder="Ex.: Fine Line, Blackwork..."
                />
              </Field>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Minutagem / Duração (min)">
                <Input
                  type="number"
                  min={15}
                  max={720}
                  step={15}
                  value={srvDuration}
                  onChange={(e) => setSrvDuration(e.target.value)}
                />
              </Field>

              <Field label="Quantidade de sessões">
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={srvSessionsCount}
                  onChange={(e) => setSrvSessionsCount(e.target.value)}
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "30m", mins: "30" },
                { label: "1h", mins: "60" },
                { label: "2h", mins: "120" },
                { label: "3h", mins: "180" },
                { label: "4h", mins: "240" },
              ].map((preset) => (
                <button
                  key={preset.mins}
                  type="button"
                  onClick={() => setSrvDuration(preset.mins)}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-medium border cursor-pointer ${
                    srvDuration === preset.mins
                      ? "bg-[var(--brand-champagne-subtle)] border-[var(--brand-champagne)] text-[var(--brand-champagne)]"
                      : "bg-[var(--bg-canvas)] border-[var(--border-default)] text-[var(--text-secondary)]"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {Number(srvSessionsCount) > 1 ? (
              <div className="rounded-2xl bg-[var(--brand-champagne-subtle)] border border-[var(--brand-champagne)]/35 px-3.5 py-2.5 text-[11px] text-[var(--text-primary)]">
                Quando a 1ª sessão deste serviço for concluída na Agenda, você e a cliente receberão o alerta para reagendar a próxima sessão ({Number(srvSessionsCount)} sessões ao todo).
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor R$ (opcional)">
                <CurrencyInput value={srvPrice} onValueChange={setSrvPrice} />
              </Field>
              <Field label="Sinal R$ (opcional)">
                <CurrencyInput
                  value={srvDeposit}
                  onValueChange={setSrvDeposit}
                />
              </Field>
            </div>

            <Field label="Descrição / observações (opcional)">
              <Textarea
                value={srvDescription}
                onChange={(e) => setSrvDescription(e.target.value)}
                placeholder="Detalhes incluídos neste serviço..."
                className="min-h-[70px]"
              />
            </Field>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setServiceModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Salvando..." : "Salvar serviço"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* MODAL CRIAR CATEGORIA */}
      {categoryModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/65 backdrop-blur-xs p-0 md:p-4">
          <form
            onSubmit={handleCreateCategory}
            className="w-full max-h-[88dvh] md:max-w-sm rounded-t-[28px] md:rounded-3xl bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 p-5 space-y-4 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">
                Nova categoria
              </h2>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="h-8 w-8 rounded-full bg-[var(--bg-canvas)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error ? (
              <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs font-medium">
                {error}
              </div>
            ) : null}

            <Field label="Nome da categoria">
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Ex.: Fine Line, Fechamento, Piercing..."
                required
              />
            </Field>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setCategoryModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Salvando..." : "Criar categoria"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(deleteServiceTarget)}
        title="Excluir serviço?"
        description={`"${deleteServiceTarget?.name || ""}" será removido do catálogo.`}
        confirmLabel="Excluir serviço"
        danger
        loading={saving}
        onConfirm={handleConfirmDeleteService}
        onCancel={() => setDeleteServiceTarget(null)}
      />

      <ConfirmModal
        open={Boolean(deleteCategoryTarget)}
        title="Remover categoria?"
        description={`A categoria "${deleteCategoryTarget?.name || ""}" será removida da lista de categorias.`}
        confirmLabel="Remover"
        danger
        loading={saving}
        onConfirm={handleConfirmDeleteCategory}
        onCancel={() => setDeleteCategoryTarget(null)}
      />
    </div>
  );
}
