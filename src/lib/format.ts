export const STUDIO_TIMEZONE = "America/Sao_Paulo";
export const STUDIO_LOCALE = "pt-BR";

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "object" && value !== null && "toString" in value) {
    const n = Number(String(value));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function formatBRL(value: unknown, hide = false): string {
  if (hide) return "R$ ••••";
  const amount = toNumber(value);
  return new Intl.NumberFormat(STUDIO_LOCALE, {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(STUDIO_LOCALE, {
    timeZone: STUDIO_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateLongBR(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(STUDIO_LOCALE, {
    timeZone: STUDIO_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatTimeBR(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(STUDIO_LOCALE, {
    timeZone: STUDIO_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatDateTimeBR(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(STUDIO_LOCALE, {
    timeZone: STUDIO_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function getGreetingBR(date: Date = new Date()): string {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: STUDIO_TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).format(date);
  const hour = Number(hourStr);
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function toISODateSP(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDIO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function parseSPDateTime(dateStr: string, timeStr: string): Date {
  // Constrói instante exato no fuso America/Sao_Paulo (-03:00 padrão vigente no Brasil)
  const cleanDate = dateStr.slice(0, 10);
  const cleanTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return new Date(`${cleanDate}T${cleanTime}-03:00`);
}

export function formatPhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  if (!digits) return "";
  if (digits.length > 11 && digits.startsWith("55")) {
    const rest = digits.slice(2);
    if (rest.length <= 2) return `+55 (${rest}`;
    if (rest.length <= 6) return `+55 (${rest.slice(0, 2)}) ${rest.slice(2)}`;
    if (rest.length <= 10) {
      return `+55 (${rest.slice(0, 2)}) ${rest.slice(2, 6)}-${rest.slice(6)}`;
    }
    return `+55 (${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7, 11)}`;
  }
  const local = digits.slice(0, 11);
  if (local.length <= 2) return `(${local}`;
  if (local.length <= 6) return `(${local.slice(0, 2)}) ${local.slice(2)}`;
  if (local.length <= 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7, 11)}`;
}

export function formatCpfCnpjBR(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (!d) return "";
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatCepBR(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function formatCurrencyDisplayBR(
  value: string | number | readonly string[] | undefined | null
): string {
  if (value === undefined || value === null || value === "") return "";
  const raw = Array.isArray(value) ? value[0] : String(value);
  if (!raw.trim()) return "";
  const num = Number(raw);
  if (!Number.isFinite(num)) return "";
  return new Intl.NumberFormat(STUDIO_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function digitsToCanonicalCurrency(rawInput: string): string {
  const digits = rawInput.replace(/\D/g, "").slice(0, 13);
  if (!digits) return "";
  const cents = Number(digits);
  if (!Number.isFinite(cents) || cents === 0) return "";
  return (cents / 100).toFixed(2);
}

export function formatDecimalDisplayBR(
  value: string | number | undefined | null
): string {
  if (value === undefined || value === null || value === "") return "";
  const raw = String(value).replace(",", ".");
  if (!raw) return "";
  const hasTrailingDot = raw.endsWith(".");
  const [intPartRaw, decPart] = raw.split(".");
  const cleanInt = (intPartRaw || "").replace(/\D/g, "");
  const formattedInt = cleanInt
    ? Number(cleanInt).toLocaleString(STUDIO_LOCALE)
    : "0";
  if (hasTrailingDot) return `${formattedInt},`;
  if (decPart !== undefined) return `${formattedInt},${decPart.replace(/\D/g, "")}`;
  return cleanInt ? formattedInt : "";
}

export function formatSequentialCode(
  codeNumber?: number | null,
  fallbackId?: string
): string {
  if (
    typeof codeNumber === "number" &&
    Number.isFinite(codeNumber) &&
    codeNumber > 0
  ) {
    return String(Math.floor(codeNumber)).padStart(4, "0");
  }
  return fallbackId ? fallbackId.slice(-4).toUpperCase() : "0001";
}

export function parseDecimalInputBR(rawInput: string): string {
  const cleaned = rawInput.replace(/[^0-9.,]/g, "");
  if (!cleaned) return "";
  // Última vírgula ou ponto representa o separador decimal quando houver fração curta
  const lastComma = cleaned.lastIndexOf(",");
  if (lastComma !== -1) {
    const intPart = cleaned.slice(0, lastComma).replace(/\D/g, "");
    const decPart = cleaned.slice(lastComma + 1).replace(/\D/g, "").slice(0, 4);
    if (!intPart && !decPart) return "";
    return `${intPart || "0"}.${decPart}`;
  }
  const lastDot = cleaned.lastIndexOf(".");
  if (lastDot !== -1 && cleaned.length - lastDot - 1 <= 2 && cleaned.indexOf(".") === lastDot) {
    const intPart = cleaned.slice(0, lastDot).replace(/\D/g, "");
    const decPart = cleaned.slice(lastDot + 1).replace(/\D/g, "").slice(0, 4);
    return `${intPart || "0"}.${decPart}`;
  }
  return cleaned.replace(/\D/g, "");
}
