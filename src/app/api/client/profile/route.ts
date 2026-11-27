import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthApi, UnauthorizedError } from "@/lib/security/rbac";
import { recordAuditLog } from "@/lib/security/audit";
import { notifyStudioAdmins } from "@/lib/notifications";

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(3),
  whatsapp: z.string().trim().min(8),
  phone: z.string().trim().optional(),
  birthDate: z.string().optional().or(z.literal("")),
  preferredStyles: z.array(z.string()).default([]),
  marketingOptIn: z.boolean(),
});

const lgpdSchema = z.object({
  action: z.enum(["export_data", "request_anonymization"]),
  notes: z.string().trim().optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user.clientId) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const birthDate = d.birthDate
      ? new Date(`${d.birthDate.slice(0, 10)}T00:00:00.000Z`)
      : null;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { name: d.fullName },
      }),
      prisma.client.update({
        where: { id: user.clientId },
        data: {
          fullName: d.fullName,
          whatsapp: d.whatsapp,
          phone: d.phone || d.whatsapp,
          birthDate:
            birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : null,
          preferredStyles: d.preferredStyles,
          marketingOptIn: d.marketingOptIn,
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro ao atualizar perfil." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user.clientId) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = lgpdSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    if (parsed.data.action === "export_data") {
      // Exporta estritamente dados do titular — exclui notas administrativas privadas!
      const exportPayload = await prisma.client.findUnique({
        where: { id: user.clientId },
        select: {
          fullName: true,
          whatsapp: true,
          phone: true,
          email: true,
          birthDate: true,
          preferredStyles: true,
          marketingOptIn: true,
          lgpdConsentAt: true,
          createdAt: true,
          appointments: {
            select: {
              title: true,
              startAt: true,
              durationMinutes: true,
              status: true,
              clientNotes: true,
            },
          },
          projects: {
            select: {
              name: true,
              style: true,
              bodyRegion: true,
              approxSizeCm: true,
              stage: true,
              aftercareGuidance: true,
            },
          },
          quoteRequests: {
            select: {
              title: true,
              ideaDescription: true,
              style: true,
              status: true,
              createdAt: true,
            },
          },
          documentSignatures: {
            select: {
              kind: true,
              templateVersion: true,
              signedAt: true,
              contentHash: true,
            },
          },
          passports: {
            select: {
              title: true,
              completedDate: true,
              style: true,
              bodyRegion: true,
              clientMeaning: true,
            },
          },
        },
      });

      await prisma.lgpdRequest.create({
        data: {
          clientId: user.clientId,
          userId: user.id,
          type: "EXPORT",
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      await recordAuditLog({
        actorUserId: user.id,
        action: "LGPD_DATA_EXPORTED",
        entityType: "Client",
        entityId: user.clientId,
      });

      return NextResponse.json({ data: exportPayload });
    }

    const req = await prisma.lgpdRequest.create({
      data: {
        clientId: user.clientId,
        userId: user.id,
        type: "ANONYMIZATION",
        status: "PENDING",
        notes: parsed.data.notes || "Solicitação feita pelo titular via Área do Cliente.",
      },
    });

    await notifyStudioAdmins({
      eventType: "LGPD_REQUEST",
      title: "Solicitação LGPD de anonimização",
      body: `${user.name} solicitou anonimização/exclusão de dados pela Área do Cliente.`,
      linkUrl: "/admin/configuracoes#lgpd",
    });

    return NextResponse.json({ request: req }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro ao processar solicitação LGPD." },
      { status: 500 }
    );
  }
}
