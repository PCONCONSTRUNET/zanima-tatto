import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthApi, UnauthorizedError } from "@/lib/security/rbac";
import {
  dispatchNotification,
  dispatchPushEvent,
  notifyStudioAdmins,
} from "@/lib/notifications";
import { formatDateTimeBR, formatSequentialCode } from "@/lib/format";

const actionSchema = z.object({
  appointmentId: z.string().min(1),
  action: z.enum(["confirm_presence", "request_reschedule", "cancel_appointment"]),
  note: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user.clientId) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const appt = await prisma.appointment.findUnique({
      where: { id: parsed.data.appointmentId },
    });
    if (!appt || appt.clientId !== user.clientId) {
      return NextResponse.json(
        { error: "Agendamento não encontrado." },
        { status: 404 }
      );
    }

    const apptCode = formatSequentialCode(appt.codeNumber, appt.id);
    const whenBR = formatDateTimeBR(appt.startAt);

    if (parsed.data.action === "confirm_presence") {
      const updated = await prisma.$transaction([
        prisma.appointment.update({
          where: { id: appt.id },
          data: {
            confirmedAt: new Date(),
            status:
              appt.status === "AWAITING_CONFIRMATION"
                ? "CONFIRMED"
                : appt.status,
          },
        }),
        prisma.appointmentHistory.create({
          data: {
            appointmentId: appt.id,
            changedByUserId: user.id,
            previousStatus: appt.status,
            newStatus:
              appt.status === "AWAITING_CONFIRMATION"
                ? "CONFIRMED"
                : appt.status,
            reason: "Presença confirmada pelo cliente na Área do Cliente",
          },
        }),
      ]);

      await notifyStudioAdmins({
        eventType: "PRESENCE_CONFIRMED",
        title: `Presença confirmada (#${apptCode})`,
        body: `${user.name} confirmou presença para "${appt.title}" (${whenBR}).`,
        linkUrl: "/admin/agenda",
        pushRule: "BOOKING_CONFIRMED_CLIENT",
      });

      return NextResponse.json({ appointment: updated[0] });
    }

    if (parsed.data.action === "cancel_appointment") {
      if (appt.status === "COMPLETED" || appt.status === "CANCELLED") {
        return NextResponse.json(
          { error: "Este agendamento não pode ser cancelado." },
          { status: 400 }
        );
      }

      const updated = await prisma.$transaction([
        prisma.appointment.update({
          where: { id: appt.id },
          data: { status: "CANCELLED" },
        }),
        prisma.appointmentHistory.create({
          data: {
            appointmentId: appt.id,
            changedByUserId: user.id,
            previousStatus: appt.status,
            newStatus: "CANCELLED",
            reason: parsed.data.note
              ? `Cancelado pelo cliente: ${parsed.data.note}`
              : "Cancelado pelo cliente na Área do Cliente",
          },
        }),
      ]);

      await notifyStudioAdmins({
        eventType: "APPOINTMENT_CANCELLED",
        title: `Agendamento #${apptCode} cancelado pelo cliente`,
        body: `${user.name} cancelou "${appt.title}" (${whenBR}).`,
        linkUrl: "/admin/agenda",
        pushRule: "APPOINTMENT_CANCELLED",
      });

      await dispatchNotification({
        recipientUserId: user.id,
        eventType: "APPOINTMENT_CANCELLED",
        title: `Agendamento #${apptCode} cancelado`,
        body: `Seu agendamento "${appt.title}" de ${whenBR} foi cancelado.`,
        linkUrl: "/minha-conta/agenda",
        channels: ["IN_APP"],
      });

      await dispatchPushEvent({
        rule: "APPOINTMENT_CANCELLED",
        target: "CLIENT",
        userIds: [user.id],
        title: `Agendamento #${apptCode} cancelado`,
        body: `Seu agendamento "${appt.title}" de ${whenBR} foi cancelado.`,
        linkUrl: "/minha-conta/agenda",
      });

      return NextResponse.json({ appointment: updated[0] });
    }

    await prisma.appointmentHistory.create({
      data: {
        appointmentId: appt.id,
        changedByUserId: user.id,
        previousStatus: appt.status,
        newStatus: appt.status,
        reason: `Solicitação de reagendamento: ${parsed.data.note || "Sem observação"}`,
      },
    });

    await notifyStudioAdmins({
      eventType: "RESCHEDULE_REQUESTED",
      title: "Solicitação de reagendamento",
      body: `${user.name} solicitou reagendamento de "${appt.title}": ${parsed.data.note || ""}`,
      linkUrl: "/admin/agenda",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro ao atualizar agendamento." },
      { status: 500 }
    );
  }
}
