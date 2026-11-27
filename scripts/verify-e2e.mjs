import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const prisma = new PrismaClient();

function extractCookie(res) {
  const setCookie = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);
  return setCookie
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    ...opts,
  });
  return res;
}

async function main() {
  console.log("1. Verificando rotas públicas, manifest e SW...");
  for (const route of ["/", "/termos", "/portfolio", "/desenhos-disponiveis", "/orcamento", "/agendar", "/cuidados", "/privacidade", "/entrar", "/cadastro", "/manifest.webmanifest", "/sw.js"]) {
    const r = await req(route);
    assert.equal(r.status, 200, `Rota pública ${route} retornou ${r.status}`);
  }

  console.log("2. Verificando bloqueio de rotas autenticadas sem sessão...");
  const adminUnauth = await req("/admin");
  assert.equal(adminUnauth.status, 307);
  const apiUnauth = await req("/api/admin/clients");
  assert.equal(apiUnauth.status, 401);

  console.log("3. Autenticando como proprietária (OWNER)...");
  const loginRes = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.ADMIN_BOOTSTRAP_EMAIL || "leticia@zanimatattoo.com.br",
      password: process.env.ADMIN_BOOTSTRAP_PASSWORD || "Zanima@2026!",
    }),
  });
  assert.equal(loginRes.status, 200, "Login da proprietária falhou");
  const ownerCookie = extractCookie(loginRes);
  assert.ok(ownerCookie.includes("zanima_session"), "Cookie de sessão ausente");

  for (const adminRoute of ["/admin", "/admin/agenda", "/admin/clientes", "/admin/projetos", "/admin/orcamentos", "/admin/financeiro", "/admin/mais", "/admin/estoque", "/admin/documentos", "/admin/fidelizacao", "/admin/notificacoes", "/admin/configuracoes"]) {
    const r = await req(adminRoute, { headers: { Cookie: ownerCookie } });
    assert.equal(r.status, 200, `Rota admin ${adminRoute} retornou ${r.status}`);
  }

  console.log("4. Testando cadastro manual de cliente, nota privada e vínculo por código...");
  const clientRes = await req("/api/admin/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      fullName: "Cliente Teste Verificação",
      whatsapp: "(11) 98888-7777",
      phone: "(11) 98888-7777",
      email: "teste.verificacao@zanima.local",
      preferredStyles: ["Fine Line"],
      initialPrivateNote: "NOTA_PRIVADA_SECRETA_ADMIN",
    }),
  });
  assert.equal(clientRes.status, 201);
  const { client } = await clientRes.json();
  assert.ok(client.identityVerificationCode, "Código de vínculo não gerado");

  const regRes = await req("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Cliente Teste Verificação",
      email: "teste.verificacao@zanima.local",
      whatsapp: "(11) 98888-7777",
      verificationCode: client.identityVerificationCode,
      password: "Cliente@2026",
      lgpdConsent: true,
      marketingOptIn: false,
    }),
  });
  assert.equal(regRes.status, 201, "Cadastro com código de vínculo falhou");
  const clientCookie = extractCookie(regRes);

  // Cliente não pode acessar admin nem exportar notas privadas
  const clientToAdmin = await req("/api/admin/clients", {
    headers: { Cookie: clientCookie },
  });
  assert.equal(clientToAdmin.status, 403);

  const lgpdRes = await req("/api/client/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: clientCookie },
    body: JSON.stringify({ action: "export_data" }),
  });
  assert.equal(lgpdRes.status, 200);
  const lgpdText = await lgpdRes.text();
  assert.ok(!lgpdText.includes("NOTA_PRIVADA_SECRETA_ADMIN"), "Vazamento de nota privada!");

  console.log("5. Testando concorrência simultânea na Agenda (anti-double-booking)...");
  const futureDate = "2026-12-18";
  const [b1, b2] = await Promise.all([
    req("/api/admin/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({
        clientId: client.id,
        title: "Sessão Teste Concorrência A",
        date: futureDate,
        startTime: "14:00",
        durationMinutes: 90,
        bufferAfterMinutes: 15,
      }),
    }),
    req("/api/admin/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({
        clientId: client.id,
        title: "Sessão Teste Concorrência B",
        date: futureDate,
        startTime: "14:30",
        durationMinutes: 90,
        bufferAfterMinutes: 15,
      }),
    }),
  ]);
  const statuses = [b1.status, b2.status].sort();
  assert.deepEqual(statuses, [201, 409], `Esperado [201, 409], recebido ${statuses}`);

  console.log("6. Testando orçamento, PDF, conversão em projeto e bloqueio de portfólio sem consentimento...");
  const quoteRes = await req("/api/admin/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      clientId: client.id,
      title: "Floral Delicado Teste",
      style: "Floral",
      bodyRegion: "Antebraço",
      approxSizeCm: "10 cm",
      ideaDescription: "Ramo fino botânico",
      quotedAmount: 750,
      depositAmount: 225,
    }),
  });
  assert.equal(quoteRes.status, 201);
  const { quote } = await quoteRes.json();

  const pdfRes = await req(`/api/admin/quotes/${quote.id}/pdf`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(pdfRes.status, 200);
  const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
  assert.equal(pdfBytes.subarray(0, 4).toString("ascii"), "%PDF");

  const convRes = await req(`/api/admin/quotes/${quote.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ action: "convert", plannedSessions: 1, scheduleSession: false }),
  });
  assert.equal(convRes.status, 201);
  const { project } = await convRes.json();

  // Tentar publicar no portfólio sem autorização de imagem deve falhar 400
  const pubFail = await req(`/api/admin/projects/${project.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ allowPublicPortfolio: true }),
  });
  assert.equal(pubFail.status, 400);

  // Concluir projeto gera Passaporte Digital
  const completeProj = await req(`/api/admin/projects/${project.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ stage: "COMPLETED" }),
  });
  assert.equal(completeProj.status, 200);
  const passport = await prisma.tattooPassport.findUnique({
    where: { projectId: project.id },
  });
  assert.ok(passport, "Passaporte digital não foi gerado automaticamente ao concluir projeto");

  console.log("7. Testando Financeiro (Estúdio vs Pessoal, STAFF bloqueado, Transferência sem dupla contagem, PDF/CSV)...");
  const staffCreate = await req("/api/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      action: "create_staff",
      name: "Staff Teste",
      email: "staff.teste@zanima.local",
      password: "Staff@2026!",
      permissions: { agenda: true, studioFinance: true },
    }),
  });
  assert.equal(staffCreate.status, 201);

  const staffLogin = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "staff.teste@zanima.local",
      password: "Staff@2026!",
    }),
  });
  const staffCookie = extractCookie(staffLogin);

  const staffPersonal = await req("/api/admin/finance/transactions?context=PERSONAL", {
    headers: { Cookie: staffCookie },
  });
  assert.equal(staffPersonal.status, 403, "STAFF não pode acessar financeiro pessoal");

  const studioAcc = await prisma.financialAccount.findFirst({
    where: { context: "STUDIO" },
  });
  const personalAcc = await prisma.financialAccount.findFirst({
    where: { context: "PERSONAL" },
  });
  const studioCat = await prisma.financialCategory.findFirst({
    where: { context: "STUDIO", kind: "INCOME" },
  });

  const txRes = await req("/api/admin/finance/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      context: "STUDIO",
      type: "INCOME",
      description: "Receita Teste",
      amount: 500,
      competenceDate: "2026-11-26",
      status: "RECEIVED",
      categoryId: studioCat.id,
      accountId: studioAcc.id,
      paymentMethod: "PIX",
    }),
  });
  assert.equal(txRes.status, 201);

  const trRes = await req("/api/admin/finance/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      fromAccountId: studioAcc.id,
      toAccountId: personalAcc.id,
      amount: 200,
      transferDate: "2026-11-26",
      description: "Retirada teste",
      transferKind: "OWNER_WITHDRAWAL",
    }),
  });
  assert.equal(trRes.status, 201);

  const [studioAfter, personalAfter, txCountAfter] = await Promise.all([
    prisma.financialAccount.findUnique({ where: { id: studioAcc.id } }),
    prisma.financialAccount.findUnique({ where: { id: personalAcc.id } }),
    prisma.financialTransaction.count({ where: { description: "Retirada teste" } }),
  ]);
  assert.equal(Number(studioAfter.currentBalance), 300);
  assert.equal(Number(personalAfter.currentBalance), 200);
  assert.equal(txCountAfter, 0, "Transferência interna não pode gerar FinancialTransaction!");

  const csvRes = await req("/api/admin/finance/export?context=ALL&format=csv", {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(csvRes.status, 200);
  const finPdfRes = await req("/api/admin/finance/export?context=ALL&format=pdf", {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(finPdfRes.status, 200);

  console.log("8. Limpando registros temporários do teste para manter banco limpo...");
  await prisma.tattooPassport.deleteMany({ where: { clientId: client.id } });
  await prisma.appointmentHistory.deleteMany({});
  await prisma.appointment.deleteMany({ where: { clientId: client.id } });
  await prisma.quoteRequest.deleteMany({ where: { clientId: client.id } });
  await prisma.tattooProject.deleteMany({ where: { clientId: client.id } });
  await prisma.clientNote.deleteMany({ where: { clientId: client.id } });
  await prisma.lgpdRequest.deleteMany({ where: { clientId: client.id } });
  await prisma.internalTransfer.deleteMany({ where: { description: "Retirada teste" } });
  await prisma.financialTransaction.deleteMany({ where: { description: "Receita Teste" } });
  await prisma.financialAccount.updateMany({ data: { currentBalance: 0 } });
  await prisma.notification.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.client.delete({ where: { id: client.id } });
  await prisma.user.deleteMany({
    where: { email: { in: ["teste.verificacao@zanima.local", "staff.teste@zanima.local"] } },
  });

  console.log("TODOS OS TESTES E2E PASSARAM COM SUCESSO!");
}

main()
  .catch((e) => {
    console.error("FALHA NO TESTE E2E:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
