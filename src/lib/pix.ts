/**
 * Utilitário oficial BR Code (Pix EMV QR Code + Copia e Cola) padrão Banco Central.
 */

export const STUDIO_PIX_KEY = "leticiamacalossi30@gmail.com";
export const STUDIO_OWNER_WHATSAPP = "5548992155488";
export const STUDIO_OWNER_WHATSAPP_DISPLAY = "(48) 99215-5488";
export const DEFAULT_DEPOSIT_AMOUNT = 50;

function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

function sanitizeAscii(input: string, maxLen: number): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 .\-@/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, maxLen);
}

function crc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixPayload({
  pixKey = STUDIO_PIX_KEY,
  merchantName = "LETICIA ZANINI MACALOSSI",
  merchantCity = "BRASIL",
  amount,
  txid = "***",
}: {
  pixKey?: string;
  merchantName?: string;
  merchantCity?: string;
  amount: number;
  txid?: string;
}): string {
  const cleanName = sanitizeAscii(merchantName, 25) || "ZANIMA TATTOO";
  const cleanCity = sanitizeAscii(merchantCity, 15) || "BRASIL";
  const cleanTxid =
    txid
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 25) || "***";

  const merchantAccountInfo = tlv(
    "26",
    tlv("00", "br.gov.bcb.pix") + tlv("01", pixKey.trim())
  );

  const formattedAmount = amount > 0 ? amount.toFixed(2) : "";

  const base =
    tlv("00", "01") +
    merchantAccountInfo +
    tlv("52", "0000") +
    tlv("53", "986") +
    (formattedAmount ? tlv("54", formattedAmount) : "") +
    tlv("58", "BR") +
    tlv("59", cleanName) +
    tlv("60", cleanCity) +
    tlv("62", tlv("05", cleanTxid)) +
    "6304";

  return base + crc16Ccitt(base);
}

export function buildPixReceiptWhatsappUrl(params: {
  clientName: string;
  serviceName: string;
  dateBR: string;
  time: string;
  paymentChoice: "DEPOSIT" | "FULL";
  paidAmountFormatted: string;
  appointmentCode: string;
  whatsappDigits?: string;
}): string {
  const phone = (params.whatsappDigits || STUDIO_OWNER_WHATSAPP).replace(
    /\D/g,
    ""
  );
  const targetPhone = phone.startsWith("55") ? phone : `55${phone}`;
  const kindLabel =
    params.paymentChoice === "FULL"
      ? `Valor total (${params.paidAmountFormatted})`
      : `Sinal de reserva (${params.paidAmountFormatted})`;

  const message = [
    `Olá Leticia! Acabei de realizar o pagamento via Pix do meu agendamento no ZANIMA TATTOO:`,
    ``,
    `• Cliente: ${params.clientName}`,
    `• Serviço: ${params.serviceName}`,
    `• Data e horário: ${params.dateBR} às ${params.time}`,
    `• Valor pago: ${kindLabel}`,
    `• Código: #${params.appointmentCode}`,
    ``,
    `Segue em anexo o comprovante do Pix para confirmação!`,
  ].join("\n");

  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
}
