export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Pendente",
  AWAITING_CONFIRMATION: "Aguardando confirmação",
  AWAITING_DEPOSIT: "Aguardando sinal",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em atendimento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

export const APPOINTMENT_STATUS_TONE: Record<string, StatusTone> = {
  REQUESTED: "warning",
  AWAITING_CONFIRMATION: "warning",
  AWAITING_DEPOSIT: "warning",
  CONFIRMED: "success",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "danger",
};

export const PROJECT_STAGE_ORDER = [
  "INITIAL_IDEA",
  "QUOTING",
  "AWAITING_APPROVAL",
  "ART_DEVELOPMENT",
  "ART_APPROVED",
  "SESSION_SCHEDULED",
  "IN_EXECUTION",
  "HEALING",
  "COMPLETED",
] as const;

export const PROJECT_STAGE_LABELS: Record<string, string> = {
  INITIAL_IDEA: "Ideia inicial",
  QUOTING: "Em orçamento",
  AWAITING_APPROVAL: "Aguardando aprovação",
  ART_DEVELOPMENT: "Desenvolvimento da arte",
  ART_APPROVED: "Arte aprovada",
  SESSION_SCHEDULED: "Sessão agendada",
  IN_EXECUTION: "Em execução",
  HEALING: "Cicatrização",
  COMPLETED: "Concluído",
};

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  NEW: "Solicitado",
  ANALYZING: "Em análise",
  SENT: "Enviado ao cliente",
  APPROVED: "Aprovado",
  DECLINED: "Recusado",
  EXPIRED: "Expirado",
  CONVERTED: "Convertido em projeto",
};

export const QUOTE_STATUS_TONE: Record<string, StatusTone> = {
  NEW: "info",
  ANALYZING: "warning",
  SENT: "info",
  APPROVED: "success",
  DECLINED: "danger",
  EXPIRED: "neutral",
  CONVERTED: "success",
};

export const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  PAID: "Pago",
  RECEIVED: "Recebido",
  PENDING: "Pendente",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
};

export const TRANSACTION_STATUS_TONE: Record<string, StatusTone> = {
  PAID: "success",
  RECEIVED: "success",
  PENDING: "warning",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  CASH: "Dinheiro",
  BANK_TRANSFER: "Transferência bancária",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  FAILED: "Falhou",
  REFUNDED: "Estornado",
  CANCELLED: "Cancelado",
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  BANK: "Conta bancária",
  CASH: "Dinheiro em espécie",
  DIGITAL_WALLET: "Carteira digital",
  RESERVE: "Reserva financeira",
};

export const TRANSFER_KIND_LABELS: Record<string, string> = {
  OWNER_WITHDRAWAL: "Retirada de comissão (Estúdio → Pessoal)",
  RESERVE_DEPOSIT: "Aporte em reserva",
  ACCOUNT_TRANSFER: "Transferência entre contas",
};

export const DOCUMENT_KIND_LABELS: Record<string, string> = {
  ANAMNESIS: "Ficha / Pré-procedimento",
  CONSENT: "Termo de consentimento",
  IMAGE_AUTHORIZATION: "Autorização de uso de imagem",
  CANCELLATION_POLICY: "Política de cancelamento",
  LIABILITY_TERM: "Termo de responsabilidade",
  CUSTOM: "Documento personalizado",
};

export const TATTOO_STYLES = ["Fine Line", "Floral", "Minimalista"] as const;
