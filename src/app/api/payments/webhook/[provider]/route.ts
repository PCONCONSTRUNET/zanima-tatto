import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIpAndAgent } from "@/lib/security/session";
import { toNumber } from "@/lib/format";
import type { GatewayProvider, Prisma } from "@prisma/client";

function verifyHmacSignature(
  rawBody: string,
  providedSignature: string | null,
  secret: string | undefined
): boolean {
  if (!secret || !providedSignature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(providedSignature.replace(/^sha256=/i, ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> }
) {
  const { ipAddress } = await getClientIpAndAgent();
  const limit = checkRateLimit(`webhook:${ipAddress}`, 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { provider } = await context.params;
  const providerMap: Record<string, GatewayProvider> = {
    "mercado-pago": "MERCADO_PAGO",
    "efi-bank": "EFI_BANK",
  };
  const gateway = providerMap[provider];
  if (!gateway) {
    return NextResponse.json({ error: "Gateway desconhecido" }, { status: 404 });
  }

  const secret =
    gateway === "MERCADO_PAGO"
      ? process.env.MERCADOPAGO_WEBHOOK_SECRET
      : process.env.EFI_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "Gateway não configurado neste ambiente." },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const signature =
    request.headers.get("x-signature") ||
    request.headers.get("x-webhook-signature");

  const signatureValid = verifyHmacSignature(rawBody, signature, secret);
  if (!signatureValid) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const eventId = String(
    payload.id || payload.eventId || crypto.createHash("sha256").update(rawBody).digest("hex")
  );
  const eventType = String(payload.type || payload.action || "payment.update");
  const externalRef = payload.external_reference
    ? String(payload.external_reference)
    : null;

  // Idempotência de webhook
  const alreadyProcessed = await prisma.paymentWebhookEvent.findUnique({
    where: { eventId },
  });
  if (alreadyProcessed) {
    return NextResponse.json({ ok: true, deduplicated: true });
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentWebhookEvent.create({
      data: {
        provider: gateway,
        eventId,
        eventType,
        payloadJson: payload as Prisma.InputJsonValue,
        signatureValid: true,
        processedAt: new Date(),
      },
    });

    if (externalRef && String(payload.status).toLowerCase() === "approved") {
      const payment = await tx.payment.findFirst({
        where: { externalReference: externalRef, status: "PENDING" },
        include: { financialTransaction: true },
      });

      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "CONFIRMED", confirmedAt: new Date() },
        });

        if (payment.financialTransaction) {
          await tx.financialTransaction.update({
            where: { id: payment.financialTransaction.id },
            data: { status: "RECEIVED", paidAt: new Date() },
          });
          if (payment.financialTransaction.accountId) {
            await tx.financialAccount.update({
              where: { id: payment.financialTransaction.accountId },
              data: {
                currentBalance: { increment: toNumber(payment.amount) },
              },
            });
          }
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}
