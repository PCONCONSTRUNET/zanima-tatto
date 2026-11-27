"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, Package, Plus } from "lucide-react";
import { formatBRL, formatDateBR, formatDateTimeBR } from "@/lib/format";
import {
  Button,
  CurrencyInput,
  DecimalInput,
  EmptyState,
  Field,
  Input,
  Select,
  StatusBadge,
} from "@/components/ui/primitives";

type StockItemRow = {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentQty: number;
  minQty: number;
  unitCost: number;
  batchCode: string | null;
  expiresAt: string | null;
  supplierName: string | null;
};

type MovementRow = {
  id: string;
  itemName: string;
  unit: string;
  type: string;
  quantity: number;
  cost: number;
  projectName: string | null;
  notes: string | null;
  createdAt: string;
};

export function StockClient({
  items,
  suppliers,
  movements,
  projects,
}: {
  items: StockItemRow[];
  suppliers: Array<{ id: string; name: string; phone: string | null; email: string | null }>;
  movements: MovementRow[];
  projects: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [itemModal, setItemModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [movModal, setMovModal] = useState(false);

  // Item
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Cartuchos e Agulhas");
  const [unit, setUnit] = useState("un");
  const [currentQty, setCurrentQty] = useState("0");
  const [minQty, setMinQty] = useState("5");
  const [unitCost, setUnitCost] = useState("0");
  const [batchCode, setBatchCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [supplierId, setSupplierId] = useState("");

  // Supplier
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");

  // Movement
  const [movItemId, setMovItemId] = useState(items[0]?.id || "");
  const [movType, setMovType] = useState<"IN" | "OUT" | "ADJUSTMENT">("OUT");
  const [movQty, setMovQty] = useState("1");
  const [movProjectId, setMovProjectId] = useState("");
  const [movNotes, setMovNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lowStockCount = items.filter((i) => i.currentQty <= i.minQty).length;

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "item",
          name,
          category,
          unit,
          currentQty: Number(currentQty || 0),
          minQty: Number(minQty || 0),
          unitCost: Number(unitCost || 0),
          batchCode: batchCode || undefined,
          expiresAt: expiresAt || undefined,
          supplierId: supplierId || null,
        }),
      });
      if (res.ok) {
        setItemModal(false);
        setName("");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "supplier",
          name: supName,
          phone: supPhone || undefined,
        }),
      });
      if (res.ok) {
        setSupplierModal(false);
        setSupName("");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "movement",
          stockItemId: movItemId,
          type: movType,
          quantity: Number(movQty),
          projectId: movProjectId || null,
          notes: movNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao registrar movimentação.");
        return;
      }
      setMovModal(false);
      setMovNotes("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">
            Controle de Estoque e Insumos
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Agulhas, cartuchos, tintas, descartáveis, lotes, validade e custo por sessão.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setSupplierModal(true)}>
            Fornecedores ({suppliers.length})
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setMovModal(true)}
            disabled={items.length === 0}
          >
            Entrada / Saída
          </Button>
          <Button size="sm" onClick={() => setItemModal(true)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Novo material
          </Button>
        </div>
      </div>

      {lowStockCount > 0 ? (
        <div className="p-3.5 rounded-[8px] bg-[var(--status-warning-bg)] text-xs flex items-center gap-2 text-[var(--status-warning)]">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span>
            {lowStockCount} item(ns) atingiram o estoque mínimo e precisam de reposição.
          </span>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" strokeWidth={1.5} />}
          title="Nenhum material cadastrado"
          description="Cadastre agulhas, cartuchos, tintas, luvas e insumos de higienização para acompanhar validade, lotes e custo estimado por tatuagem."
          action={
            <Button size="sm" onClick={() => setItemModal(true)}>
              Cadastrar primeiro item
            </Button>
          }
        />
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] overflow-hidden">
          <div className="hidden md:grid grid-cols-12 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-secondary)] bg-[var(--bg-subtle)] border-b border-[var(--border-default)]">
            <span className="col-span-4">Material / Categoria</span>
            <span className="col-span-2">Lote / Validade</span>
            <span className="col-span-2">Saldo atual</span>
            <span className="col-span-2">Custo unit.</span>
            <span className="col-span-2 text-right">Situação</span>
          </div>
          <ul className="divide-y divide-[var(--border-default)]">
            {items.map((item) => {
              const isLow = item.currentQty <= item.minQty;
              return (
                <li
                  key={item.id}
                  className="grid grid-cols-1 md:grid-cols-12 items-center gap-2 px-4 py-3 text-xs"
                >
                  <div className="md:col-span-4 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {item.category}
                      {item.supplierName ? ` • ${item.supplierName}` : ""}
                    </p>
                  </div>
                  <div className="md:col-span-2 text-[var(--text-secondary)] tabular-nums">
                    <p>{item.batchCode ? `Lote ${item.batchCode}` : "Sem lote"}</p>
                    {item.expiresAt ? (
                      <p>Val: {formatDateBR(item.expiresAt)}</p>
                    ) : null}
                  </div>
                  <div className="md:col-span-2 font-semibold tabular-nums">
                    {item.currentQty} {item.unit}{" "}
                    <span className="font-normal text-[var(--text-secondary)]">
                      (mín: {item.minQty})
                    </span>
                  </div>
                  <div className="md:col-span-2 tabular-nums">
                    {formatBRL(item.unitCost)}
                  </div>
                  <div className="md:col-span-2 flex md:justify-end">
                    <StatusBadge
                      label={isLow ? "Reposição necessária" : "Normal"}
                      tone={isLow ? "warning" : "success"}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Histórico de consumo */}
      {movements.length > 0 ? (
        <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-default)]">
            <h2 className="font-display text-sm font-semibold">
              Histórico de movimentações e consumo
            </h2>
          </div>
          <ul className="divide-y divide-[var(--border-default)]">
            {movements.map((m) => (
              <li
                key={m.id}
                className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {m.type === "IN" ? (
                    <ArrowUp className="h-3.5 w-3.5 text-[var(--status-success)] shrink-0" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5 text-[var(--status-danger)] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {m.itemName} ({m.quantity} {m.unit})
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate">
                      {m.projectName ? `Projeto: ${m.projectName} • ` : ""}
                      {formatDateTimeBR(m.createdAt)}
                    </p>
                  </div>
                </div>
                <span className="tabular-nums text-[var(--text-secondary)] shrink-0">
                  {formatBRL(m.cost)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Modal Novo Material */}
      {itemModal ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4">
          <form
            onSubmit={handleCreateItem}
            className="w-full max-h-[88dvh] md:max-w-lg bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 rounded-t-[28px] md:rounded-3xl p-5 space-y-3.5 overflow-y-auto shadow-2xl"
          >
            <h3 className="font-display text-base font-semibold">
              Novo material de estoque
            </h3>
            <Field label="Nome do material">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Cartucho 3RL Fine Line"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria">
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Cartuchos e Agulhas">Cartuchos e Agulhas</option>
                  <option value="Tintas">Tintas</option>
                  <option value="Luvas e Descartáveis">Luvas e Descartáveis</option>
                  <option value="Higienização e Biossegurança">Higienização</option>
                  <option value="Pós-Tatuagem">Pós-Tatuagem</option>
                </Select>
              </Field>
              <Field label="Unidade">
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="un, cx, ml"
                  required
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Qtd. inicial">
                <DecimalInput
                  value={currentQty}
                  onValueChange={setCurrentQty}
                />
              </Field>
              <Field label="Estoque mín.">
                <DecimalInput
                  value={minQty}
                  onValueChange={setMinQty}
                />
              </Field>
              <Field label="Custo unit.">
                <CurrencyInput
                  value={unitCost}
                  onValueChange={setUnitCost}
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Lote">
                <Input
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                />
              </Field>
              <Field label="Validade">
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </Field>
              <Field label="Fornecedor">
                <Select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">Opcional</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setItemModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Salvar item
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Modal Fornecedor */}
      {supplierModal ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4">
          <form
            onSubmit={handleCreateSupplier}
            className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 rounded-t-[28px] md:rounded-3xl p-5 space-y-4 overflow-y-auto shadow-2xl"
          >
            <h3 className="font-display text-base font-semibold">
              Fornecedores
            </h3>
            <Field label="Nome do fornecedor">
              <Input
                value={supName}
                onChange={(e) => setSupName(e.target.value)}
                required
              />
            </Field>
            <Field label="Telefone / WhatsApp">
              <Input
                type="tel"
                inputMode="tel"
                placeholder="(00) 90000-0000"
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
              />
            </Field>
            {suppliers.length > 0 ? (
              <ul className="max-h-32 overflow-y-auto text-xs divide-y divide-[var(--border-default)]">
                {suppliers.map((s) => (
                  <li key={s.id} className="py-1.5 flex justify-between">
                    <span>{s.name}</span>
                    <span className="text-[var(--text-secondary)]">
                      {s.phone || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSupplierModal(false)}
              >
                Fechar
              </Button>
              <Button type="submit" disabled={saving}>
                Adicionar fornecedor
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Modal Movimentação */}
      {movModal ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4">
          <form
            onSubmit={handleMovement}
            className="w-full max-h-[88dvh] md:max-w-md bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 rounded-t-[28px] md:rounded-3xl p-5 space-y-3.5 overflow-y-auto shadow-2xl"
          >
            <h3 className="font-display text-base font-semibold">
              Registrar entrada ou consumo
            </h3>
            {error ? (
              <div className="p-2.5 rounded-[6px] bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
                {error}
              </div>
            ) : null}
            <Field label="Material">
              <Select
                value={movItemId || items[0]?.id || ""}
                onChange={(e) => setMovItemId(e.target.value)}
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.currentQty} {i.unit})
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <Select
                  value={movType}
                  onChange={(e) =>
                    setMovType(e.target.value as "IN" | "OUT" | "ADJUSTMENT")
                  }
                >
                  <option value="OUT">Saída / Consumo</option>
                  <option value="IN">Entrada / Compra</option>
                  <option value="ADJUSTMENT">Ajuste de saldo</option>
                </Select>
              </Field>
              <Field label="Quantidade">
                <DecimalInput
                  value={movQty}
                  onValueChange={setMovQty}
                  required
                />
              </Field>
            </div>
            <Field label="Projeto vinculado (para custo por tatuagem)">
              <Select
                value={movProjectId}
                onChange={(e) => setMovProjectId(e.target.value)}
              >
                <option value="">Uso geral do estúdio</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Observações">
              <Input
                value={movNotes}
                onChange={(e) => setMovNotes(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMovModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Confirmar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
