import "dotenv/config";
import crypto from "crypto";
import { promisify } from "util";
import { PrismaClient } from "@prisma/client";

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

const prisma = new PrismaClient();

async function main() {
  const ownerEmail = (
    process.env.ADMIN_BOOTSTRAP_EMAIL || "leticia@zanimatattoo.com.br"
  )
    .trim()
    .toLowerCase();
  const ownerName =
    process.env.ADMIN_BOOTSTRAP_NAME || "Leticia Zanini Macalossi";
  const ownerPassword =
    process.env.ADMIN_BOOTSTRAP_PASSWORD || "Zanima@2026!";

  let owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    owner = await prisma.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        passwordHash: await hashPassword(ownerPassword),
        role: "OWNER",
        permissions: {
          agenda: true,
          clients: true,
          projects: true,
          quotes: true,
          studioFinance: true,
          personalFinance: true,
          stock: true,
          documents: true,
          loyalty: true,
          settings: true,
        },
        themePreference: "DARK",
      },
    });
    console.log(`Conta proprietária criada: ${ownerEmail}`);
  } else {
    console.log(`Conta proprietária já existente: ${ownerEmail}`);
  }

  // Configurações do Estúdio (singleton)
  await prisma.studioSetting.upsert({
    where: { id: "studio-default" },
    update: {},
    create: {
      id: "studio-default",
      studioName: "ZANIMA TATTOO",
      ownerName: "Leticia Zanini Macalossi",
      instagramHandle: "@zanima_tattoo",
      whatsappNumber: "(48) 99215-5488",
      email: ownerEmail,
      address: "",
      cityState: "Brasil",
      defaultDepositPercent: 30,
      cancellationPolicyHours: 48,
      acceptedPaymentMethods: ["PIX", "CREDIT_CARD", "DEBIT_CARD", "CASH"],
      heroHeadline: "Traços finos com intenção, leveza e permanência.",
      heroSubheadline:
        "Estúdio especializado em tatuagens Fine Line, Floral e Minimalista, administrado por Leticia Zanini Macalossi.",
      bioText:
        "No ZANIMA TATTOO, cada criação nasce de um atendimento calmo, escuta cuidadosa e desenho exclusivo. Unimos precisão técnica em traço fino, estética botânica e biossegurança rigorosa para resultados delicados e duradouros.",
      careBeforeJson: [
        {
          title: "Hidratação da pele",
          description:
            "Hidrate a região diariamente na semana anterior e evite exposição solar intensa ou queimaduras.",
        },
        {
          title: "Alimentação e descanso",
          description:
            "Compareça alimentado, bem hidratado e descansado. Evite bebidas alcoólicas nas 24 horas anteriores.",
        },
        {
          title: "Vestuário confortável",
          description:
            "Use roupas confortáveis que facilitem o acesso à região que será tatuada sem apertar a pele após a sessão.",
        },
      ],
      careAfterJson: [
        {
          title: "Higienização suave",
          description:
            "Lave delicadamente com água fria ou morna e sabonete neutro sem fragrância. Seque sem esfregar com papel toalha limpo.",
        },
        {
          title: "Hidratação orientada",
          description:
            "Aplique camada fina da pomada ou hidratante recomendado conforme o cronograma entregue ao final da sessão.",
        },
        {
          title: "Proteção solar e atrito",
          description:
            "Evite piscina, mar, sauna, sol direto e não remova casquinhas durante a fase de cicatrização.",
        },
      ],
      faqJson: [
        {
          question: "Como funciona a solicitação de orçamento?",
          answer:
            "Você envia sua ideia, estilo desejado, região do corpo, tamanho aproximado em centímetros e referências visuais pelo portal. Após análise, retornamos com valores, sinal de reserva e disponibilidade.",
        },
        {
          question: "Como é garantida a reserva de horário?",
          answer:
            "O horário é reservado mediante confirmação e pagamento do sinal combinado, abatido integralmente do valor total da tatuagem.",
        },
        {
          question: "Posso acompanhar minha tatuagem após a sessão?",
          answer:
            "Sim. Pela Área Exclusiva do Cliente você acompanha seu projeto, orientações personalizadas, registro de evolução pós-tatuagem e seu passaporte digital Minha História na Pele.",
        },
      ],
    },
  });

  // Regras padrão de disponibilidade semanal (Segunda a Sábado)
  for (let day = 0; day <= 6; day++) {
    await prisma.availabilityRule.upsert({
      where: { dayOfWeek: day },
      update: {},
      create: {
        dayOfWeek: day,
        startTime: "09:00",
        endTime: day === 6 ? "14:00" : "18:00",
        slotStepMinutes: 30,
        bufferMinutes: 0,
        isActive: day !== 0,
      },
    });
  }

  // Contas financeiras iniciais (sem saldo fictício)
  const existingAccounts = await prisma.financialAccount.count({
    where: { ownerUserId: owner.id },
  });
  if (existingAccounts === 0) {
    await prisma.financialAccount.createMany({
      data: [
        {
          ownerUserId: owner.id,
          context: "STUDIO",
          name: "Conta Principal do Estúdio",
          type: "BANK",
          initialBalance: 0,
          currentBalance: 0,
        },
        {
          ownerUserId: owner.id,
          context: "STUDIO",
          name: "Caixa Presencial Estúdio",
          type: "CASH",
          initialBalance: 0,
          currentBalance: 0,
        },
        {
          ownerUserId: owner.id,
          context: "PERSONAL",
          name: "Conta Pessoal",
          type: "BANK",
          initialBalance: 0,
          currentBalance: 0,
        },
        {
          ownerUserId: owner.id,
          context: "PERSONAL",
          name: "Reserva Financeira Pessoal",
          type: "RESERVE",
          initialBalance: 0,
          currentBalance: 0,
        },
      ],
    });
  }

  // Categorias financeiras estruturadas (Estúdio + Pessoal)
  const existingCategories = await prisma.financialCategory.count({
    where: { ownerUserId: owner.id },
  });
  if (existingCategories === 0) {
    await prisma.financialCategory.createMany({
      data: [
        // Estúdio - Receitas
        { ownerUserId: owner.id, context: "STUDIO", name: "Sinais de Reserva", kind: "INCOME", isSystem: true },
        { ownerUserId: owner.id, context: "STUDIO", name: "Sessões de Tatuagem", kind: "INCOME", isSystem: true },
        { ownerUserId: owner.id, context: "STUDIO", name: "Vale-Presente e Flashes", kind: "INCOME", isSystem: true },
        // Estúdio - Despesas
        { ownerUserId: owner.id, context: "STUDIO", name: "Compra de Materiais e Insumos", kind: "EXPENSE", isSystem: true },
        { ownerUserId: owner.id, context: "STUDIO", name: "Aluguel e Condomínio", kind: "EXPENSE", isSystem: true },
        { ownerUserId: owner.id, context: "STUDIO", name: "Energia, Água e Internet", kind: "EXPENSE", isSystem: true },
        { ownerUserId: owner.id, context: "STUDIO", name: "Equipamentos e Manutenção", kind: "EXPENSE", isSystem: true },
        { ownerUserId: owner.id, context: "STUDIO", name: "Investimentos do Estúdio", kind: "EXPENSE", isSystem: true },
        { ownerUserId: owner.id, context: "STUDIO", name: "Taxas e Impostos", kind: "EXPENSE", isSystem: true },
        // Pessoal - Receitas
        { ownerUserId: owner.id, context: "PERSONAL", name: "Outras Receitas Pessoais", kind: "INCOME", isSystem: true },
        // Pessoal - Despesas
        { ownerUserId: owner.id, context: "PERSONAL", name: "Moradia e Contas Domésticas", kind: "EXPENSE", isSystem: true },
        { ownerUserId: owner.id, context: "PERSONAL", name: "Supermercado", kind: "EXPENSE", isSystem: true },
        { ownerUserId: owner.id, context: "PERSONAL", name: "Alimentação", kind: "EXPENSE", isSystem: true },
        { ownerUserId: owner.id, context: "PERSONAL", name: "Transporte e Combustível", kind: "EXPENSE", isSystem: true },
        { ownerUserId: owner.id, context: "PERSONAL", name: "Saúde e Bem-estar", kind: "EXPENSE", isSystem: true },
        { ownerUserId: owner.id, context: "PERSONAL", name: "Assinaturas e Serviços", kind: "EXPENSE", isSystem: true },
        { ownerUserId: owner.id, context: "PERSONAL", name: "Lazer", kind: "EXPENSE", isSystem: true },
      ],
    });
  }

  // Estado inicial real dos canais de notificação e gateways
  const providers = ["WHATSAPP", "EMAIL", "PUSH", "MERCADO_PAGO", "EFI_BANK"] as const;
  for (const provider of providers) {
    await prisma.notificationChannelConfig.upsert({
      where: { provider },
      update: {},
      create: {
        provider,
        isEnabled: false,
        isConfigured: false,
        configSummaryJson: {},
      },
    });
  }

  console.log("Seed inicial ZANIMA TATTOO concluído com sucesso.");
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
