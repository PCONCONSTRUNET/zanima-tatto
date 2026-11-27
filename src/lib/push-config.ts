export type PushEventRuleKey =
  | "BOOKING_CONFIRMED_CLIENT"
  | "APPOINTMENT_CANCELLED"
  | "CLIENT_NO_SHOW"
  | "CLIENT_MARKED_PAID"
  | "ADMIN_PAYMENT_REGISTERED";

export interface PushRuleToggle {
  client: boolean;
  admin: boolean;
}

export interface PushSettingsPayload {
  globalEnabled: boolean;
  adminEnabled: boolean;
  clientEnabled: boolean;
  appId: string;
  safariWebId: string;
  rules: Record<PushEventRuleKey, PushRuleToggle>;
}

export interface PushRuleCatalogItem {
  key: PushEventRuleKey;
  title: string;
  description: string;
  defaultClient: boolean;
  defaultAdmin: boolean;
}

export const PUSH_RULE_CATALOG: PushRuleCatalogItem[] = [
  {
    key: "BOOKING_CONFIRMED_CLIENT",
    title: "Agendamento confirmado",
    description:
      "Dispara quando o cliente conclui um agendamento ou quando o horário é confirmado.",
    defaultClient: true,
    defaultAdmin: false,
  },
  {
    key: "APPOINTMENT_CANCELLED",
    title: "Agendamento cancelado",
    description:
      "Dispara quando o cliente ou o administrador cancela um agendamento.",
    defaultClient: true,
    defaultAdmin: true,
  },
  {
    key: "CLIENT_NO_SHOW",
    title: "Cliente faltou",
    description:
      "Ao marcar falta na agenda, envia push 'Você faltou ao seu agendamento' ao cliente e alerta ao admin.",
    defaultClient: true,
    defaultAdmin: true,
  },
  {
    key: "CLIENT_MARKED_PAID",
    title: "Pagamento concluído (Cliente apertou 'Já paguei')",
    description:
      "Dispara quando o cliente confirma o pagamento via Pix na hora de agendar.",
    defaultClient: false,
    defaultAdmin: true,
  },
  {
    key: "ADMIN_PAYMENT_REGISTERED",
    title: "Pagamento concluído registrado pelo Admin",
    description:
      "Dispara para o cliente ao registrar pagamentos manuais (sinal, parcial ou quitação).",
    defaultClient: true,
    defaultAdmin: false,
  },
];

export function getDefaultPushRules(): Record<PushEventRuleKey, PushRuleToggle> {
  return {
    BOOKING_CONFIRMED_CLIENT: { client: true, admin: false },
    APPOINTMENT_CANCELLED: { client: true, admin: true },
    CLIENT_NO_SHOW: { client: true, admin: true },
    CLIENT_MARKED_PAID: { client: false, admin: true },
    ADMIN_PAYMENT_REGISTERED: { client: true, admin: false },
  };
}

export const DEFAULT_PUSH_SETTINGS: PushSettingsPayload = {
  globalEnabled: true,
  adminEnabled: true,
  clientEnabled: true,
  appId: "",
  safariWebId: "",
  rules: getDefaultPushRules(),
};
