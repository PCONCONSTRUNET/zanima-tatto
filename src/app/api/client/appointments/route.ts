import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthApi, UnauthorizedError } from "@/lib/security/rbac";
import { notifyStudioAdmins } from "@/lib/notifications";

const actionSchema = z.object({
  appointmentId: z.string().min(1),
  action: z.enum(["confirm_presence", "request_reschedule"]),
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
        title: "Presença confirmada",
        body: `${user.name} confirmou presença para "${appt.title}".`,
        linkUrl: "/admin/agenda",
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
