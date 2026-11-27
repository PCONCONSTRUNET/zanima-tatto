"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Megaphone, Sparkles, Tag, Users, Watch } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { TATTOO_STYLES } from "@/lib/domain-labels";
import {
  Button,
  CurrencyInput,
  DecimalInput,
  Field,
  Input,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";

export function LoyaltyClient({
  coupons,
  vouchers,
  flashes,
  waitlist,
  referrals,
  campaigns,
  clients,
}: {
  coupons: Array<{
    id: string;
    code: string;
    description: string;
    discountType: string;
    discountValue: number;
    usedCount: number;
    maxUses: number | null;
  }>;
  vouchers: Array<{
    id: string;
    code: string;
    purchaserName: string;
    recipientName: string;
    amount: number;
    balance: number;
    status: string;
  }>;
  flashes: Array<{
    id: string;
    title: string;
    style: string;
    suggestedRegion: string;
    approxSizeCm: string;
    price: number;
    status: string;
  }>;
  waitlist: Array<{
    id: string;
    name: string;
    contact: string;
    preferredStyle: string;
    preferredDays: string | null;
    status: string;
  }>;
  referrals: Array<{
    id: string;
    referrerName: string;
    referredName: string;
    referredContact: string;
    status: string;
    rewardDescription: string | null;
  }>;
  campaigns: Array<{
    id: string;
    title: string;
    channel: string;
    targetCount: number;
    status: string;
  }>;
  clients: Array<{ id: string; fullName: string; marketingOptIn: boolean }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<
    "flashes" | "cupons" | "vales" | "indicacoes" | "espera" | "campanhas"
  >("flashes");
  const [saving, setSaving] = useState(false);

  // Quick states
  const [flashTitle, setFlashTitle] = useState("");
  const [flashStyle, setFlashStyle] = useState<string>(TATTOO_STYLES[0]);
  const [flashRegion, setFlashRegion] = useState("");
  const [flashSize, setFlashSize] = useState("");
  const [flashPrice, setFlashPrice] = useState("");
  const [flashImageId, setFlashImageId] = useState<string | null>(null);

  const [couponCode, setCouponCode] = useState("");
  const [couponDesc, setCouponDesc] = useState("");
  const [couponType, setCouponType] = useState("PERCENT");
  const [couponVal, setCouponVal] = useState("");

  const [vBuyer, setVBuyer] = useState("");
  const [vRecipient, setVRecipient] = useState("");
  const [vAmount, setVAmount] = useState("");

  const [wName, setWName] = useState("");
  const [wContact, setWContact] = useState("");
  const [wStyle, setWStyle] = useState<string>(TATTOO_STYLES[0]);
  const [wDays, setWDays] = useState("");

  const [refClientId, setRefClientId] = useState(clients[0]?.id || "");
  const [refName, setRefName] = useState("");
  const [refContact, setRefContact] = useState("");
  const [refReward, setRefReward] = useState("");

  const [cpTitle, setCpTitle] = useState("");
  const [cpChannel, setCpChannel] = useState("WHATSAPP");
  const [cpMsg, setCpMsg] = useState("");

  const optedInCount = clients.filter((c) => c.marketingOptIn).length;

  const submitEntity = async (payload: Record<string, unknown>, reset: () => void) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        reset();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFlashUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("visibility", "PUBLIC_PORTFOLIO");
    const res = await fetch("/api/files", { method: "POST", body: fd });
    if (res.ok) {
      const data = await res.json();
      setFlashImageId(data.file.id);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">
          Fidelização, Desenhos e Marketing
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Catálogo exclusivo, cupons, vale-presente, indicações, lista de espera e campanhas respeitando LGPD ({optedInCount} clientes com opt-in).
        </p>
      </div>

      <div className="border-b border-[var(--border-default)] flex items-center gap-1 overflow-x-auto">
        {(
          [
            ["flashes", `Desenhos Exclusivos (${flashes.length})`],
            ["cupons", `Cupons (${coupons.length})`],
            ["vales", `Vale-Presente (${vouchers.length})`],
            ["indicacoes", `Indicações (${referrals.length})`],
            ["espera", `Lista de Espera (${waitlist.length})`],
            ["campanhas", `Campanhas (${campaigns.length})`],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap cursor-pointer ${
              tab === k
                ? "border-[var(--action-primary)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)]"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "flashes" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitEntity(
                {
                  entity: "flash",
                  title: flashTitle,
                  style: flashStyle,
                  suggestedRegion: flashRegion,
                  approxSizeCm: flashSize,
                  price: Number(flashPrice),
                  imageFileId: flashImageId,
                },
                () => {
                  setFlashTitle("");
                  setFlashPrice("");
                  setFlashImageId(null);
                }
              );
            }}
            className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-4 space-y-3"
          >
            <h2 className="font-display text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              Publicar desenho exclusivo
            </h2>
            <Field label="Título da arte">
              <Input value={flashTitle} onChange={(e) => setFlashTitle(e.target.value)} required />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Estilo">
                <Select value={flashStyle} onChange={(e) => setFlashStyle(e.target.value)}>
                  {TATTOO_STYLES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Valor">
                <CurrencyInput value={flashPrice} onValueChange={setFlashPrice} required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Região sugerida">
                <Input value={flashRegion} onChange={(e) => setFlashRegion(e.target.value)} required />
              </Field>
              <Field label="Tamanho aprox.">
                <Input value={flashSize} onChange={(e) => setFlashSize(e.target.value)} required />
              </Field>
            </div>
            <Field label="Imagem do desenho (opcional)">
              <Input type="file" accept="image/*" onChange={handleFlashUpload} />
            </Field>
            <Button type="submit" size="sm" disabled={saving}>Publicar no catálogo</Button>
          </form>

          <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] divide-y divide-[var(--border-default)]">
            {flashes.length === 0 ? (
              <p className="p-5 text-xs text-[var(--text-secondary)]">Nenhum desenho exclusivo cadastrado.</p>
            ) : (
              flashes.map((f) => (
                <div key={f.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="text-sm font-medium">{f.title}</p>
                    <p className="text-[var(--text-secondary)]">{f.style} • {f.suggestedRegion} ({f.approxSizeCm})</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-semibold tabular-nums">{formatBRL(f.price)}</p>
                    <StatusBadge label={f.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === "cupons" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitEntity(
                {
                  entity: "coupon",
                  code: couponCode,
                  description: couponDesc,
                  discountType: couponType,
                  discountValue: Number(couponVal),
                },
                () => {
                  setCouponCode("");
                  setCouponDesc("");
                  setCouponVal("");
                }
              );
            }}
            className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-4 space-y-3"
          >
            <h2 className="font-display text-sm font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4" strokeWidth={1.5} />
              Criar cupom promocional
            </h2>
            <Field label="Código">
              <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="ZANIMA10" required />
            </Field>
            <Field label="Descrição">
              <Input value={couponDesc} onChange={(e) => setCouponDesc(e.target.value)} required />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tipo">
                <Select value={couponType} onChange={(e) => setCouponType(e.target.value)}>
                  <option value="PERCENT">Percentual (%)</option>
                  <option value="FIXED">Valor fixo (R$)</option>
                </Select>
              </Field>
              <Field label="Desconto">
                {couponType === "FIXED" ? (
                  <CurrencyInput value={couponVal} onValueChange={setCouponVal} required />
                ) : (
                  <DecimalInput value={couponVal} onValueChange={setCouponVal} placeholder="10" required />
                )}
              </Field>
            </div>
            <Button type="submit" size="sm" disabled={saving}>Criar cupom</Button>
          </form>
          <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] divide-y divide-[var(--border-default)]">
            {coupons.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-sm">{c.code}</p>
                  <p className="text-[var(--text-secondary)]">{c.description}</p>
                </div>
                <span className="font-semibold tabular-nums">
                  {c.discountType === "PERCENT" ? `${c.discountValue}%` : formatBRL(c.discountValue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "vales" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitEntity(
                { entity: "voucher", purchaserName: vBuyer, recipientName: vRecipient, amount: Number(vAmount) },
                () => { setVBuyer(""); setVRecipient(""); setVAmount(""); }
              );
            }}
            className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-4 space-y-3"
          >
            <h2 className="font-display text-sm font-semibold flex items-center gap-2">
              <Gift className="h-4 w-4" strokeWidth={1.5} />
              Emitir vale-presente
            </h2>
            <Field label="Comprador"><Input value={vBuyer} onChange={(e) => setVBuyer(e.target.value)} required /></Field>
            <Field label="Presenteado(a)"><Input value={vRecipient} onChange={(e) => setVRecipient(e.target.value)} required /></Field>
            <Field label="Valor"><CurrencyInput value={vAmount} onValueChange={setVAmount} required /></Field>
            <Button type="submit" size="sm" disabled={saving}>Emitir vale</Button>
          </form>
          <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] divide-y divide-[var(--border-default)]">
            {vouchers.map((v) => (
              <div key={v.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-sm">{v.code} • Para {v.recipientName}</p>
                  <p className="text-[var(--text-secondary)]">Comprado por {v.purchaserName}</p>
                </div>
                <span className="font-semibold tabular-nums">{formatBRL(v.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "indicacoes" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitEntity(
                { entity: "referral", referrerClientId: refClientId, referredName: refName, referredContact: refContact, rewardDescription: refReward },
                () => { setRefName(""); setRefContact(""); setRefReward(""); }
              );
            }}
            className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-4 space-y-3"
          >
            <h2 className="font-display text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" strokeWidth={1.5} />
              Registrar indicação
            </h2>
            <Field label="Cliente que indicou">
              <Select value={refClientId} onChange={(e) => setRefClientId(e.target.value)}>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
              </Select>
            </Field>
            <Field label="Nome do indicado"><Input value={refName} onChange={(e) => setRefName(e.target.value)} required /></Field>
            <Field label="Contato"><Input value={refContact} onChange={(e) => setRefContact(e.target.value)} required /></Field>
            <Field label="Benefício"><Input value={refReward} onChange={(e) => setRefReward(e.target.value)} placeholder="Ex: R$ 50 na próxima sessão" /></Field>
            <Button type="submit" size="sm" disabled={saving || !refClientId}>Salvar indicação</Button>
          </form>
          <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] divide-y divide-[var(--border-default)]">
            {referrals.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <p className="font-medium text-sm">{r.referredName} ({r.referredContact})</p>
                  <p className="text-[var(--text-secondary)]">Indicado por {r.referrerName}</p>
                </div>
                <StatusBadge label={r.status} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "espera" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitEntity(
                { entity: "waitlist", name: wName, contact: wContact, preferredStyle: wStyle, preferredDays: wDays },
                () => { setWName(""); setWContact(""); setWDays(""); }
              );
            }}
            className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-4 space-y-3"
          >
            <h2 className="font-display text-sm font-semibold flex items-center gap-2">
              <Watch className="h-4 w-4" strokeWidth={1.5} />
              Adicionar à lista de espera
            </h2>
            <Field label="Nome"><Input value={wName} onChange={(e) => setWName(e.target.value)} required /></Field>
            <Field label="WhatsApp / E-mail"><Input value={wContact} onChange={(e) => setWContact(e.target.value)} required /></Field>
            <Field label="Estilo">
              <Select value={wStyle} onChange={(e) => setWStyle(e.target.value)}>
                {TATTOO_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Preferência de dias"><Input value={wDays} onChange={(e) => setWDays(e.target.value)} /></Field>
            <Button type="submit" size="sm" disabled={saving}>Adicionar</Button>
          </form>
          <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] divide-y divide-[var(--border-default)]">
            {waitlist.map((w) => (
              <div key={w.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <p className="font-medium text-sm">{w.name}</p>
                  <p className="text-[var(--text-secondary)]">{w.contact} • {w.preferredStyle} {w.preferredDays ? `• ${w.preferredDays}` : ""}</p>
                </div>
                <StatusBadge label={w.status} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "campanhas" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitEntity(
                { entity: "campaign", title: cpTitle, segment: "Clientes com autorização LGPD (opt-in)", message: cpMsg, channel: cpChannel },
                () => { setCpTitle(""); setCpMsg(""); }
              );
            }}
            className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-4 space-y-3"
          >
            <h2 className="font-display text-sm font-semibold flex items-center gap-2">
              <Megaphone className="h-4 w-4" strokeWidth={1.5} />
              Nova campanha (somente opt-in)
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Alcance atual com autorização promocional ativa: {optedInCount} cliente(s).
            </p>
            <Field label="Título da campanha"><Input value={cpTitle} onChange={(e) => setCpTitle(e.target.value)} required /></Field>
            <Field label="Canal">
              <Select value={cpChannel} onChange={(e) => setCpChannel(e.target.value)}>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">E-mail</option>
              </Select>
            </Field>
            <Field label="Mensagem"><Textarea value={cpMsg} onChange={(e) => setCpMsg(e.target.value)} required /></Field>
            <Button type="submit" size="sm" disabled={saving}>Registrar rascunho</Button>
          </form>
          <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] divide-y divide-[var(--border-default)]">
            {campaigns.map((cp) => (
              <div key={cp.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <p className="font-medium text-sm">{cp.title}</p>
                  <p className="text-[var(--text-secondary)]">{cp.channel} • {cp.targetCount} elegíveis (opt-in)</p>
                </div>
                <StatusBadge label={cp.status} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
