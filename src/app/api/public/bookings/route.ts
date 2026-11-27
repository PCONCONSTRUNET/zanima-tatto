import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIpAndAgent, getCurrentUser } from "@/lib/security/session";
import {
  createAppointmentSafely,
  ScheduleConflictError,
} from "@/lib/agenda/scheduling";
import {
  formatBRL,
  formatSequentialCode,
  parseSPDateTime,
  toNumber,
} from "@/lib/format";
import {
  dispatchNotification,
  dispatchPushEvent,
  notifyStudioAdmins,
} from "@/lib/notifications";
import { DEFAULT_DEPOSIT_AMOUNT, STUDIO_PIX_KEY } from "@/lib/pix";

const bookingSchema = z.object({
  serviceId: z.string().min(1, "Selecione um serviço."),
  paymentMethod: z.enum(["PIX", "CREDIT_CARD", "CASH"]).default("PIX"),
  paymentChoice: z.enum(["DEPOSIT", "FULL"]).default("DEPOSIT"),
  paidViaPixConfirmed: z.boolean().refine(
    (v) => v === true,
    "Para concluir o agendamento, pague o sinal ou valor total via Pix e toque em 'Já paguei'."
  ),
  pixTxid: z.string().trim().max(32).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecione a data."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Selecione o horário."),
  durationMinutes: z.number().int().min(15).max(720).optional(),
  clientNotes: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const { ipAddress } = await getClientIpAndAgent();
    const limit = checkRateLimit(`pub-book:${ipAddress}`, 10, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Aguarde ${limit.retryAfterSeconds}s antes de tentar novamente.` },
        { status: 429 }
      );
    }

    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Entre na sua conta para confirmar o agendamento." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = bookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const owner = await prisma.user.findFirst({
      where: { role: "OWNER", active: true },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json(
        { error: "Estúdio indisponível para agendamento no momento." },
        { status: 503 }
      );
    }

    // Serviço obrigatório conforme cadastrado no admin
    const selectedService = await prisma.studioService.findFirst({
      where: { id: d.serviceId, isActive: true },
    });
    if (!selectedService) {
      return NextResponse.json(
        { error: "O serviço selecionado não está disponível." },
        { status: 400 }
      );
    }

    const finalTitle = selectedService.name;
    const finalDuration = selectedService.durationMinutes;
    const finalPrice = toNumber(selectedService.price);
    const serviceDeposit = toNumber(selectedService.depositAmount);
    const depositValue =
      serviceDeposit > 0 ? serviceDeposit : DEFAULT_DEPOSIT_AMOUNT;
    const chargeAmount =
      d.paymentChoice === "FULL" && finalPrice > 0 ? finalPrice : depositValue;
    const paymentKind =
      d.paymentChoice === "FULL" && finalPrice > 0 ? "FULL" : "DEPOSIT";

    const startAt = parseSPDateTime(d.date, d.startTime);
    if (startAt <= new Date()) {
      return NextResponse.json(
        { error: "Selecione uma data e horário futuros." },
        { status: 400 }
      );
    }

    let clientId = sessionUser.clientId ?? null;
    let resolvedName = sessionUser.name || "Cliente";

    if (clientId) {
      const linkedClient = await prisma.client.findUnique({
        where: { id: clientId },
        select: { fullName: true },
      });
      if (linkedClient) resolvedName = linkedClient.fullName;
    } else {
      const existingByEmail = await prisma.client.findFirst({
        where: { email: sessionUser.email.toLowerCase(), isAnonymized: false },
        select: { id: true, fullName: true },
      });
      if (existingByEmail) {
        clientId = existingByEmail.id;
        resolvedName = existingByEmail.fullName;
      } else {
        const createdClient = await prisma.client.create({
          data: {
            fullName: sessionUser.name,
            email: sessionUser.email.toLowerCase(),
            whatsapp: "(00) 00000-0000",
            phone: "(00) 00000-0000",
          },
        });
        clientId = createdClient.id;
      }
    }

    const appointment = await createAppointmentSafely({
      clientId,
      artistUserId: owner.id,
      serviceId: selectedService.id,
      title: finalTitle,
      description: selectedService.category,
      startAt,
      durationMinutes: finalDuration,
      bufferAfterMinutes: 0,
      status: "REQUESTED",
      sessionNumber: 1,
      totalSessions: selectedService.sessionsCount || 1,
      priceEstimate: finalPrice > 0 ? finalPrice : chargeAmount,
      depositRequired: depositValue,
      preferredPaymentMethod: "PIX",
      clientNotes: d.clientNotes || null,
      changedByUserId: sessionUser.id,
    });

    // Registra o pagamento Pix (Sinal R$ 50 ou Valor Total) informado pela cliente aguardando conferência do comprovante
    const payment = await prisma.payment.create({
      data: {
        clientId,
        appointmentId: appointment.id,
        kind: paymentKind,
        method: "PIX",
        gatewayProvider: "MANUAL",
        idempotencyKey: crypto.randomUUID(),
        amount: chargeAmount,
        status: "PENDING",
        notes: `Pix informado pela cliente (${
          paymentKind === "FULL" ? "Valor total" : "Sinal de reserva"
        } • Chave: ${STUDIO_PIX_KEY}${d.pixTxid ? ` • Ref: ${d.pixTxid}` : ""})`,
      },
    });

    const formattedPaid = formatBRL(chargeAmount);
    const appointmentCode = formatSequentialCode(
      appointment.codeNumber,
      appointment.id
    );

    const dateBR = d.date.split("-").reverse().join("/");

    await notifyStudioAdmins({
      eventType: "NEW_ONLINE_BOOKING",
      title: `Pagamento concluído #${appointmentCode} (Pix)`,
      body: `${resolvedName} agendou "${finalTitle}" para ${dateBR} às ${d.startTime} e informou pagamento Pix de ${formattedPaid}.`,
      linkUrl: "/admin/agenda",
      pushRule: "CLIENT_MARKED_PAID",
    });

    await dispatchNotification({
      recipientUserId: sessionUser.id,
      eventType: "APPOINTMENT_CREATED",
      title: `Agendamento #${appointmentCode} confirmado`,
      body: `"${finalTitle}" para ${dateBR} às ${d.startTime} foi registrado (${formattedPaid} via Pix). Envie o comprovante no WhatsApp para confirmação.`,
      linkUrl: "/minha-conta/agenda",
      channels: ["IN_APP"],
    });

    await dispatchPushEvent({
      rule: "BOOKING_CONFIRMED_CLIENT",
      target: "CLIENT",
      userIds: [sessionUser.id],
      title: `Agendamento #${appointmentCode} confirmado!`,
      body: `"${finalTitle}" marcado para ${dateBR} às ${d.startTime}.`,
      linkUrl: "/minha-conta/agenda",
    });

    return NextResponse.json(
      {
        appointmentId: appointment.id,
        appointmentCode,
        paymentId: payment.id,
        paymentCode: formatSequentialCode(payment.codeNumber, payment.id),
        paidAmount: chargeAmount,
        paymentChoice: d.paymentChoice,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ScheduleConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[POST /api/public/bookings]", err);
    return NextResponse.json(
      { error: "Não foi possível registrar seu agendamento." },
      { status: 500 }
    );
  }
}
