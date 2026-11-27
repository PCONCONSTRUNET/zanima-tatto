import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { formatSequentialCode, toNumber } from "@/lib/format";
import {
  APPOINTMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/domain-labels";
import { generateAppointmentReceiptPdf } from "@/lib/pdf";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApi("agenda");
    const { id } = await context.params;
    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: { select: { fullName: true, whatsapp: true, phone: true } },
        service: { select: { name: true, sessionsCount: true } },
        payments: {
          where: { status: "CONFIRMED" },
          select: { amount: true },
        },
      },
    });
    if (!appt) {
      return NextResponse.json(
        { error: "Agendamento não encontrado." },
        { status: 404 }
      );
    }

    const paidAmount = appt.payments.reduce(
      (acc, p) => acc + toNumber(p.amount),
      0
    );
    const totalSessions = Math.max(
      appt.totalSessions || 1,
      appt.service?.sessionsCount || 1
    );

    const apptCode = formatSequentialCode(appt.codeNumber, appt.id);
    const pdf = await generateAppointmentReceiptPdf({
      appointmentCode: apptCode,
      clientName: appt.client.fullName,
      clientContact: appt.client.whatsapp || appt.client.phone || "—",
      serviceTitle: appt.service?.name || appt.title,
      sessionLabel:
        totalSessions > 1
          ? `Sessão ${appt.sessionNumber}/${totalSessions}`
          : null,
      startAt: appt.startAt,
      endAt: appt.endAt,
      durationMinutes: appt.durationMinutes,
      statusLabel: APPOINTMENT_STATUS_LABELS[appt.status] || appt.status,
      paymentMethodLabel: appt.preferredPaymentMethod
        ? PAYMENT_METHOD_LABELS[appt.preferredPaymentMethod] ||
          appt.preferredPaymentMethod
        : null,
      priceEstimate: appt.priceEstimate ? toNumber(appt.priceEstimate) : null,
      depositRequired: appt.depositRequired
        ? toNumber(appt.depositRequired)
        : null,
      paidAmount,
      notes: appt.clientNotes || null,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="comprovante-agendamento-${apptCode}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao gerar comprovante." },
      { status: 500 }
    );
  }
}
