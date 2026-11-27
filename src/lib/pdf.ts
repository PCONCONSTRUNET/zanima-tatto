import "server-only";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { formatBRL, formatDateBR, formatDateTimeBR, formatTimeBR } from "@/lib/format";

const DARK_BG = "#09090B";
const SURFACE_BG = "#121215";
const BORDER_COLOR = "#27272A";
const CHAMPAGNE = "#C6A253";
const TEXT_PRIMARY = "#FAFAFA";
const TEXT_SECONDARY = "#A1A1AA";

let cachedLogoBuffer: Buffer | null | undefined;

function getZanimaLogoBuffer(): Buffer | null {
  if (cachedLogoBuffer !== undefined) return cachedLogoBuffer;
  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      "brand",
      "zanima-logo-horizontal.png"
    );
    cachedLogoBuffer = fs.existsSync(logoPath)
      ? fs.readFileSync(logoPath)
      : null;
  } catch {
    cachedLogoBuffer = null;
  }
  return cachedLogoBuffer;
}

function paintDarkPageBackground(doc: PDFKit.PDFDocument) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(DARK_BG);
  doc
    .rect(48, 24, doc.page.width - 96, 1.5)
    .fill(CHAMPAGNE);
  doc.restore();
}

export function buildPdfBuffer(
  render: (doc: PDFKit.PDFDocument) => void
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Creator: "ZANIMA TATTOO",
        Producer: "ZANIMA TATTOO",
      },
    });
    paintDarkPageBackground(doc);
    doc.on("pageAdded", () => {
      paintDarkPageBackground(doc);
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    render(doc);
    doc.end();
  });
}

export function drawStudioPdfHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string
) {
  const logo = getZanimaLogoBuffer();
  const topY = 40;

  if (logo) {
    try {
      doc.image(logo, 48, topY, { fit: [148, 46] });
    } catch {
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(TEXT_PRIMARY)
        .text("ZANIMA TATTOO", 48, topY + 6);
    }
  } else {
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(TEXT_PRIMARY)
      .text("ZANIMA TATTOO", 48, topY + 6);
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .fillColor(CHAMPAGNE)
    .text("ZANIMA TATTOO ESTÚDIO", 230, topY + 6, {
      width: 317,
      align: "right",
    });
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(TEXT_SECONDARY)
    .text("Fine Line, Floral & Minimalista  •  Leticia Zanini Macalossi", 230, topY + 20, {
      width: 317,
      align: "right",
    });

  const dividerY = topY + 56;
  doc
    .moveTo(48, dividerY)
    .lineTo(547, dividerY)
    .strokeColor(BORDER_COLOR)
    .lineWidth(1)
    .stroke();

  doc.y = dividerY + 16;
  doc.font("Helvetica-Bold").fontSize(14).fillColor(TEXT_PRIMARY).text(title, 48);
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(9.5).fillColor(TEXT_SECONDARY).text(subtitle, 48);
  doc.moveDown(0.9);
}

function drawFooter(doc: PDFKit.PDFDocument, extraNote?: string) {
  const footerY = Math.max(doc.y + 18, doc.page.height - 76);
  if (footerY > doc.page.height - 54) {
    doc.addPage();
  }
  const y = doc.y + 14;
  doc
    .moveTo(48, y)
    .lineTo(547, y)
    .strokeColor(BORDER_COLOR)
    .lineWidth(0.75)
    .stroke();
  doc.y = y + 10;
  if (extraNote) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(TEXT_SECONDARY)
      .text(extraNote, 48, doc.y, { width: 499 });
    doc.moveDown(0.4);
  }
  doc
    .font("Helvetica")
    .fontSize(8.2)
    .fillColor(CHAMPAGNE)
    .text(
      "ZANIMA TATTOO • Leticia Zanini Macalossi • Horário de Brasília (America/Sao_Paulo)",
      48,
      doc.y,
      { width: 499 }
    );
}

function drawKeyValueCard(
  doc: PDFKit.PDFDocument,
  rows: Array<[string, string]>
) {
  const startX = 48;
  const cardWidth = 499;
  for (const [label, value] of rows) {
    if (doc.y > 730) doc.addPage();
    const boxY = doc.y;
    doc.save();
    doc
      .roundedRect(startX, boxY, cardWidth, 34, 8)
      .fillAndStroke(SURFACE_BG, BORDER_COLOR);
    doc.restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(CHAMPAGNE)
      .text(label.toUpperCase(), startX + 12, boxY + 6, { width: cardWidth - 24 });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(TEXT_PRIMARY)
      .text(value || "—", startX + 12, boxY + 17, { width: cardWidth - 24 });

    doc.y = boxY + 40;
  }
}

export async function generateQuotePdf(data: {
  id: string;
  code?: string;
  clientName: string;
  clientContact: string;
  title: string;
  style: string;
  bodyRegion: string;
  approxSizeCm: string;
  ideaDescription: string;
  quotedAmount: number | string;
  depositAmount: number | string;
  paymentTerms: string;
  validUntil: Date | string | null;
  adminNotes: string | null;
  createdAt: Date | string;
}): Promise<Buffer> {
  return buildPdfBuffer((doc) => {
    drawStudioPdfHeader(
      doc,
      `Orçamento #${data.code || data.id.slice(-4).toUpperCase()}`,
      `Emitido em ${formatDateTimeBR(data.createdAt)}`
    );

    drawKeyValueCard(doc, [
      ["Cliente", data.clientName],
      ["Contato", data.clientContact],
      ["Projeto / Título", data.title],
      ["Estilo / Região / Tamanho", `${data.style} • ${data.bodyRegion} (${data.approxSizeCm})`],
      ["Valor do investimento", formatBRL(data.quotedAmount)],
      ["Sinal para reserva", formatBRL(data.depositAmount)],
      ["Condições de pagamento", data.paymentTerms || "A combinar"],
      [
        "Validade da proposta",
        data.validUntil ? formatDateBR(data.validUntil) : "7 dias corridos",
      ],
    ]);

    doc.moveDown(0.5);
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(CHAMPAGNE)
      .text("DESCRIÇÃO DA IDEIA", 48);
    doc.moveDown(0.2);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(TEXT_PRIMARY)
      .text(data.ideaDescription || "—", 48, doc.y, { width: 499 });

    if (data.adminNotes) {
      doc.moveDown(0.7);
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(CHAMPAGNE)
        .text("OBSERVAÇÕES DO ESTÚDIO", 48);
      doc.moveDown(0.2);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(TEXT_PRIMARY)
        .text(data.adminNotes, 48, doc.y, { width: 499 });
    }

    drawFooter(doc);
  });
}

export async function generateFinanceReportPdf(data: {
  scopeLabel: string;
  periodLabel: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  pendingReceive: number;
  pendingPay: number;
  rows: Array<{
    date: string;
    description: string;
    context: string;
    category: string;
    status: string;
    amount: string;
  }>;
}): Promise<Buffer> {
  return buildPdfBuffer((doc) => {
    drawStudioPdfHeader(
      doc,
      `Relatório Financeiro — ${data.scopeLabel}`,
      `Período: ${data.periodLabel} • Gerado em ${formatDateTimeBR(new Date())}`
    );

    drawKeyValueCard(doc, [
      ["Entradas efetivadas", formatBRL(data.totalIncome)],
      ["Saídas efetivadas", formatBRL(data.totalExpense)],
      ["Resultado do período", formatBRL(data.balance)],
      ["A receber (previsto) / A pagar (previsto)", `${formatBRL(data.pendingReceive)}  •  ${formatBRL(data.pendingPay)}`],
    ]);

    doc.moveDown(0.6);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(CHAMPAGNE)
      .text("LANÇAMENTOS DO PERÍODO", 48);
    doc.moveDown(0.4);

    for (const row of data.rows.slice(0, 120)) {
      if (doc.y > 735) doc.addPage();
      doc
        .font("Helvetica-Bold")
        .fontSize(8.8)
        .fillColor(TEXT_PRIMARY)
        .text(
          `${row.date}  |  ${row.category}  |  ${row.status}  |  ${row.amount}`,
          48,
          doc.y,
          { width: 499 }
        );
      doc
        .font("Helvetica")
        .fontSize(8.3)
        .fillColor(TEXT_SECONDARY)
        .text(`${row.description} (${row.context})`, 48, doc.y, { width: 499 });
      doc.moveDown(0.35);
    }

    drawFooter(
      doc,
      "Transferências internas entre contas do estúdio e contas pessoais não são contabilizadas como receitas ou despesas neste demonstrativo."
    );
  });
}

export async function generatePaymentReceiptPdf(data: {
  receiptCode: string;
  title: string;
  payerName: string;
  amount: number | string;
  paymentMethodLabel: string;
  statusLabel: string;
  paidAt: Date | string;
  categoryOrKind: string;
  notes?: string | null;
}): Promise<Buffer> {
  return buildPdfBuffer((doc) => {
    drawStudioPdfHeader(
      doc,
      `Comprovante de Pagamento #${data.receiptCode}`,
      `Emitido em ${formatDateTimeBR(new Date())}`
    );

    drawKeyValueCard(doc, [
      ["Descrição / Referência", data.title],
      ["Cliente / Pagador", data.payerName],
      ["Valor", formatBRL(data.amount)],
      ["Forma de pagamento", data.paymentMethodLabel],
      ["Tipo / Categoria", data.categoryOrKind],
      ["Status", data.statusLabel],
      ["Data de competência / confirmação", formatDateTimeBR(data.paidAt)],
    ]);

    if (data.notes) {
      doc.moveDown(0.5);
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(CHAMPAGNE)
        .text("OBSERVAÇÕES", 48);
      doc.moveDown(0.2);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(TEXT_PRIMARY)
        .text(data.notes, 48, doc.y, { width: 499 });
    }

    drawFooter(
      doc,
      "Comprovante digital emitido pelo sistema ZANIMA TATTOO."
    );
  });
}

export async function generateAppointmentReceiptPdf(data: {
  appointmentCode: string;
  clientName: string;
  clientContact: string;
  serviceTitle: string;
  sessionLabel?: string | null;
  startAt: Date | string;
  endAt: Date | string;
  durationMinutes: number;
  statusLabel: string;
  paymentMethodLabel?: string | null;
  priceEstimate?: number | null;
  depositRequired?: number | null;
  paidAmount?: number | null;
  notes?: string | null;
}): Promise<Buffer> {
  return buildPdfBuffer((doc) => {
    drawStudioPdfHeader(
      doc,
      `Comprovante de Agendamento #${data.appointmentCode}`,
      `Emitido em ${formatDateTimeBR(new Date())}`
    );

    const rows: Array<[string, string]> = [
      ["Cliente", data.clientName],
      ["Contato", data.clientContact || "—"],
      [
        "Serviço / Sessão",
        data.sessionLabel
          ? `${data.serviceTitle} (${data.sessionLabel})`
          : data.serviceTitle,
      ],
      [
        "Data e horário",
        `${formatDateBR(data.startAt)} • ${formatTimeBR(data.startAt)} às ${formatTimeBR(data.endAt)} (${data.durationMinutes} min)`,
      ],
      ["Status do atendimento", data.statusLabel],
      ["Forma de pagamento", data.paymentMethodLabel || "A definir"],
      [
        "Valor / Sinal / Pago",
        `${data.priceEstimate !== null && data.priceEstimate !== undefined ? formatBRL(data.priceEstimate) : "A definir"}  •  Sinal: ${data.depositRequired ? formatBRL(data.depositRequired) : "—"}  •  Pago: ${data.paidAmount ? formatBRL(data.paidAmount) : "R$ 0,00"}`,
      ],
    ];

    drawKeyValueCard(doc, rows);

    if (data.notes) {
      doc.moveDown(0.5);
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(CHAMPAGNE)
        .text("OBSERVAÇÕES", 48);
      doc.moveDown(0.2);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(TEXT_PRIMARY)
        .text(data.notes, 48, doc.y, { width: 499 });
    }

    drawFooter(
      doc,
      "Comprovante de reserva/agendamento emitido pelo sistema ZANIMA TATTOO. Em caso de reagendamento, avise com pelo menos 48h de antecedência."
    );
  });
}
