import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthApi, UnauthorizedError } from "@/lib/security/rbac";
import { notifyStudioAdmins } from "@/lib/notifications";

const aftercareSchema = z.object({
  projectId: z.string().min(1),
  dayNumber: z.number().int().min(1).max(365),
  clientObservation: z.string().trim().min(3, "Descreva como está a cicatrização."),
  status: z.enum(["NORMAL", "REVIEW_REQUESTED", "TOUCHUP_REQUESTED"]).default("NORMAL"),
  photoFileId: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user.clientId) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = aftercareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const project = await prisma.tattooProject.findUnique({
      where: { id: parsed.data.projectId },
    });
    if (!project || project.clientId !== user.clientId) {
      return NextResponse.json(
        { error: "Projeto não encontrado." },
        { status: 404 }
      );
    }

    const entry = await prisma.aftercareEntry.create({
      data: {
        projectId: project.id,
        clientId: user.clientId,
        dayNumber: parsed.data.dayNumber,
        clientObservation: parsed.data.clientObservation,
        status: parsed.data.status,
        photoFileId: parsed.data.photoFileId || null,
      },
    });

    await notifyStudioAdmins({
      eventType: "AFTERCARE_UPDATE",
      title:
        parsed.data.status === "TOUCHUP_REQUESTED"
          ? "Solicitação de retoque pós-tatuagem"
          : parsed.data.status === "REVIEW_REQUESTED"
          ? "Solicitação de avaliação pós-tatuagem"
          : "Registro de evolução pós-tatuagem",
      body: `${user.name} enviou registro do dia ${parsed.data.dayNumber} no projeto "${project.name}".`,
      linkUrl: `/admin/projetos/${project.id}`,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro ao registrar evolução." },
      { status: 500 }
    );
  }
}
