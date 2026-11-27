import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";
import { recordAuditLog } from "@/lib/security/audit";
import { dispatchNotification } from "@/lib/notifications";
import { PROJECT_STAGE_LABELS } from "@/lib/domain-labels";

const patchProjectSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().min(3).optional(),
  style: z.string().trim().min(2).optional(),
  bodyRegion: z.string().trim().min(2).optional(),
  approxSizeCm: z.string().trim().min(1).optional(),
  stage: z
    .enum([
      "INITIAL_IDEA",
      "QUOTING",
      "AWAITING_APPROVAL",
      "ART_DEVELOPMENT",
      "ART_APPROVED",
      "SESSION_SCHEDULED",
      "IN_EXECUTION",
      "HEALING",
      "COMPLETED",
    ])
    .optional(),
  negotiatedAmount: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
  plannedSessions: z.number().int().min(1).max(30).optional(),
  aftercareGuidance: z.string().optional().nullable(),
  allowPublicPortfolio: z.boolean().optional(),
  portfolioFeatured: z.boolean().optional(),
});

const mediaActionSchema = z.object({
  action: z.literal("add_media"),
  fileId: z.string().min(1),
  kind: z.enum(["REFERENCE", "ARTWORK", "RESULT_PHOTO", "HEALING_PHOTO"]),
  caption: z.string().trim().optional(),
  isClientVisible: z.boolean().default(true),
  hasImageConsent: z.boolean().default(false),
});

const aftercareFeedbackSchema = z.object({
  action: z.literal("aftercare_feedback"),
  entryId: z.string().min(1),
  artistFeedback: z.string().trim().min(2),
  status: z.enum([
    "NORMAL",
    "REVIEW_REQUESTED",
    "TOUCHUP_REQUESTED",
    "MEDICAL_ADVISED",
  ]),
});

const touchUpSchema = z.object({
  action: z.literal("add_touchup"),
  date: z.string().min(1),
  notes: z.string().trim().min(2),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApi("projects");
    const { id } = await context.params;
    const project = await prisma.tattooProject.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            whatsapp: true,
            email: true,
            documentSignatures: {
              where: { kind: "IMAGE_AUTHORIZATION" },
              select: { id: true, signedAt: true },
            },
          },
        },
        appointments: {
          orderBy: { startAt: "asc" },
        },
        media: {
          orderBy: { createdAt: "desc" },
          include: { file: true },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
        stockMovements: {
          orderBy: { createdAt: "desc" },
          include: { stockItem: { select: { name: true, unit: true } } },
        },
        aftercareEntries: {
          orderBy: { createdAt: "desc" },
        },
        passport: true,
        documentSignatures: {
          orderBy: { signedAt: "desc" },
          include: { template: { select: { title: true, kind: true } } },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Projeto não encontrado." },
        { status: 404 }
      );
    }

    const paidTotal = project.payments
      .filter((p) => p.status === "CONFIRMED")
      .reduce((acc, p) => acc + toNumber(p.amount), 0);

    const estimatedMaterialCost = project.stockMovements
      .filter((m) => m.type === "OUT")
      .reduce(
        (acc, m) => acc + toNumber(m.quantity) * toNumber(m.unitCostSnapshot),
        0
      );

    return NextResponse.json({
      project: {
        ...project,
        paidTotal,
        remainingBalance: Math.max(
          0,
          toNumber(project.negotiatedAmount) - paidTotal
        ),
        estimatedMaterialCost,
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
      { error: "Erro ao carregar projeto." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi("projects");
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = patchProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const current = await prisma.tattooProject.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            userId: true,
            documentSignatures: {
              where: { kind: "IMAGE_AUTHORIZATION" },
              select: { id: true },
            },
          },
        },
        media: {
          where: { kind: "RESULT_PHOTO" },
          select: { id: true, fileId: true, hasImageConsent: true },
        },
        appointments: {
          where: { status: "COMPLETED" },
          select: { id: true },
        },
      },
    });

    if (!current) {
      return NextResponse.json(
        { error: "Projeto não encontrado." },
        { status: 404 }
      );
    }

    const d = parsed.data;
    if (d.allowPublicPortfolio === true) {
      const hasTerm = current.client.documentSignatures.length > 0;
      const hasMediaConsent = current.media.some((m) => m.hasImageConsent);
      if (!hasTerm && !hasMediaConsent) {
        return NextResponse.json(
          {
            error:
              "Não é permitido publicar fotos sem autorização de uso de imagem correspondente.",
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.tattooProject.update({
        where: { id },
        data: {
          ...(d.name ? { name: d.name } : {}),
          ...(d.description ? { description: d.description } : {}),
          ...(d.style ? { style: d.style } : {}),
          ...(d.bodyRegion ? { bodyRegion: d.bodyRegion } : {}),
          ...(d.approxSizeCm ? { approxSizeCm: d.approxSizeCm } : {}),
          ...(d.stage ? { stage: d.stage } : {}),
          ...(d.negotiatedAmount !== undefined
            ? { negotiatedAmount: d.negotiatedAmount }
            : {}),
          ...(d.depositAmount !== undefined
            ? { depositAmount: d.depositAmount }
            : {}),
          ...(d.plannedSessions !== undefined
            ? { plannedSessions: d.plannedSessions }
            : {}),
          ...(d.aftercareGuidance !== undefined
            ? { aftercareGuidance: d.aftercareGuidance }
            : {}),
          ...(d.allowPublicPortfolio !== undefined
            ? { allowPublicPortfolio: d.allowPublicPortfolio }
            : {}),
          ...(d.portfolioFeatured !== undefined
            ? { portfolioFeatured: d.portfolioFeatured }
            : {}),
        },
      });

      if (d.allowPublicPortfolio === true) {
        const consentedFileIds = current.media
          .filter((m) => m.hasImageConsent)
          .map((m) => m.fileId);
        if (consentedFileIds.length > 0) {
          await tx.storedFile.updateMany({
            where: { id: { in: consentedFileIds } },
            data: { visibility: "PUBLIC_PORTFOLIO" },
          });
        }
      }

      // Se concluído, cria ou sincroniza automaticamente o Passaporte Digital ("Minha História na Pele")
      if (saved.stage === "COMPLETED") {
        const resultPhoto = current.media[0]?.fileId ?? null;
        await tx.tattooPassport.upsert({
          where: { projectId: saved.id },
          update: {
            title: saved.name,
            style: saved.style,
            bodyRegion: saved.bodyRegion,
            sessionsCount: Math.max(1, current.appointments.length, saved.plannedSessions),
            careSummary: saved.aftercareGuidance,
            ...(resultPhoto ? { featuredFileId: resultPhoto } : {}),
          },
          create: {
            projectId: saved.id,
            clientId: saved.clientId,
            title: saved.name,
            completedDate: new Date(),
            style: saved.style,
            bodyRegion: saved.bodyRegion,
            sessionsCount: Math.max(1, current.appointments.length, saved.plannedSessions),
            careSummary: saved.aftercareGuidance,
            featuredFileId: resultPhoto,
          },
        });
      }

      return saved;
    });

    if (d.stage && d.stage !== current.stage && current.client.userId) {
      await dispatchNotification({
        recipientUserId: current.client.userId,
        eventType: "PROJECT_STAGE_UPDATED",
        title: `Atualização em "${updated.name}"`,
        body:
          updated.stage === "COMPLETED"
            ? "Seu projeto foi concluído e já está disponível no passaporte digital Minha História na Pele."
            : `Etapa atualizada para: ${PROJECT_STAGE_LABELS[updated.stage]}.`,
        linkUrl:
          updated.stage === "COMPLETED"
            ? "/minha-conta/minha-historia-na-pele"
            : "/minha-conta/minhas-tattoos",
        channels: ["IN_APP"],
      });
    }

    await recordAuditLog({
      actorUserId: user.id,
      action: "PROJECT_UPDATED",
      entityType: "TattooProject",
      entityId: id,
      after: { stage: updated.stage },
    });

    return NextResponse.json({ project: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao atualizar projeto." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi("projects");
    const { id } = await context.params;
    const body = await request.json().catch(() => null);

    if (body?.action === "add_media") {
      const parsed = mediaActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Dados de mídia inválidos." }, { status: 400 });
      }
      const d = parsed.data;
      const media = await prisma.projectMedia.create({
        data: {
          projectId: id,
          fileId: d.fileId,
          kind: d.kind,
          caption: d.caption || null,
          isClientVisible: d.isClientVisible,
          hasImageConsent: d.hasImageConsent,
        },
        include: { file: true },
      });
      return NextResponse.json({ media }, { status: 201 });
    }

    if (body?.action === "aftercare_feedback") {
      const parsed = aftercareFeedbackSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
      }
      const updated = await prisma.aftercareEntry.update({
        where: { id: parsed.data.entryId },
        data: {
          artistFeedback: parsed.data.artistFeedback,
          status: parsed.data.status,
        },
      });
      return NextResponse.json({ entry: updated });
    }

    if (body?.action === "add_touchup") {
      const parsed = touchUpSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Dados de retoque inválidos." }, { status: 400 });
      }
      const passport = await prisma.tattooPassport.findUnique({
        where: { projectId: id },
      });
      if (!passport) {
        return NextResponse.json(
          { error: "Passaporte ainda não gerado para este projeto." },
          { status: 404 }
        );
      }
      const currentHistory = Array.isArray(passport.touchUpHistoryJson)
        ? (passport.touchUpHistoryJson as Array<Record<string, string>>)
        : [];
      const updated = await prisma.tattooPassport.update({
        where: { id: passport.id },
        data: {
          touchUpHistoryJson: [
            ...currentHistory,
            {
              date: parsed.data.date,
              notes: parsed.data.notes,
              recordedBy: user.name,
            },
          ],
        },
      });
      return NextResponse.json({ passport: updated });
    }

    return NextResponse.json({ error: "Ação não reconhecida." }, { status: 400 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao processar solicitação no projeto." },
      { status: 500 }
    );
  }
}
