import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  requireAdminApi,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { recordAuditLog } from "@/lib/security/audit";

const updateSchema = z.object({
  fullName: z.string().trim().min(3).optional(),
  phone: z.string().trim().min(6).optional(),
  whatsapp: z.string().trim().min(6).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  preferredStyles: z.array(z.string()).optional(),
  allergiesSummary: z.string().optional().nullable(),
  avatarFileId: z.string().optional().nullable(),
  regenerateCode: z.boolean().optional(),
});

const noteSchema = z.object({
  action: z.literal("add_note"),
  content: z.string().trim().min(2, "Escreva a observação."),
  isPrivate: z.boolean().default(true),
});

const linkReviewSchema = z.object({
  action: z.enum(["approve_link", "reject_link"]),
  linkRequestId: z.string().min(1),
  notes: z.string().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApi("clients");
    const { id } = await context.params;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, lastLoginAt: true } },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { name: true } } },
        },
        appointments: {
          orderBy: { startAt: "desc" },
          include: { project: { select: { id: true, name: true } } },
        },
        projects: {
          orderBy: { updatedAt: "desc" },
          include: {
            media: { include: { file: true } },
            payments: true,
          },
        },
        quoteRequests: { orderBy: { createdAt: "desc" } },
        payments: { orderBy: { createdAt: "desc" } },
        documentSignatures: {
          orderBy: { signedAt: "desc" },
          include: { template: { select: { title: true, kind: true } } },
        },
        passports: { orderBy: { completedDate: "desc" } },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Cliente não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ client });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao carregar prontuário." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi("clients");
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const d = parsed.data;
    const birthDateParsed = d.birthDate
      ? new Date(`${d.birthDate.slice(0, 10)}T00:00:00.000Z`)
      : undefined;

    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...(d.fullName ? { fullName: d.fullName } : {}),
        ...(d.phone ? { phone: d.phone } : {}),
        ...(d.whatsapp ? { whatsapp: d.whatsapp } : {}),
        ...(d.email !== undefined ? { email: d.email ? d.email.toLowerCase() : null } : {}),
        ...(d.birthDate !== undefined
          ? {
              birthDate:
                birthDateParsed && !Number.isNaN(birthDateParsed.getTime())
                  ? birthDateParsed
                  : null,
            }
          : {}),
        ...(d.preferredStyles ? { preferredStyles: d.preferredStyles } : {}),
        ...(d.allergiesSummary !== undefined
          ? { allergiesSummary: d.allergiesSummary }
          : {}),
        ...(d.avatarFileId !== undefined ? { avatarFileId: d.avatarFileId } : {}),
        ...(d.regenerateCode
          ? {
              identityVerificationCode: `ZN-${crypto
                .randomBytes(2)
                .toString("hex")
                .toUpperCase()}`,
            }
          : {}),
      },
    });

    await recordAuditLog({
      actorUserId: user.id,
      action: "CLIENT_UPDATED",
      entityType: "Client",
      entityId: id,
    });

    return NextResponse.json({ client: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao atualizar cliente." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminApi("clients");
    const { id } = await context.params;
    const body = await request.json().catch(() => null);

    if (body?.action === "add_note") {
      const parsed = noteSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Observação inválida." },
          { status: 400 }
        );
      }
      const note = await prisma.clientNote.create({
        data: {
          clientId: id,
          authorUserId: user.id,
          content: parsed.data.content,
          isPrivate: true, // Sempre privada ao painel administrativo
        },
        include: { author: { select: { name: true } } },
      });
      return NextResponse.json({ note }, { status: 201 });
    }

    if (body?.action === "approve_link" || body?.action === "reject_link") {
      const parsed = linkReviewSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
      }
      const linkReq = await prisma.clientLinkRequest.findUnique({
        where: { id: parsed.data.linkRequestId },
      });
      if (!linkReq || linkReq.targetClientId !== id || linkReq.status !== "PENDING") {
        return NextResponse.json(
          { error: "Solicitação de vínculo não encontrada." },
          { status: 404 }
        );
      }

      if (parsed.data.action === "reject_link") {
        await prisma.clientLinkRequest.update({
          where: { id: linkReq.id },
          data: {
            status: "REJECTED",
            reviewedByUserId: user.id,
            reviewedAt: new Date(),
            notes: parsed.data.notes || linkReq.notes,
          },
        });
        return NextResponse.json({ ok: true, status: "REJECTED" });
      }

      // Aprova vínculo: transfere referências do cadastro temporário vazio (se existir) para o cadastro histórico
      await prisma.$transaction(async (tx) => {
        const tempClient = await tx.client.findUnique({
          where: { userId: linkReq.userId },
          include: {
            appointments: { select: { id: true } },
            quoteRequests: { select: { id: true } },
            futureIdeas: { select: { id: true } },
          },
        });

        if (tempClient && tempClient.id !== id) {
          await tx.appointment.updateMany({
            where: { clientId: tempClient.id },
            data: { clientId: id },
          });
          await tx.quoteRequest.updateMany({
            where: { clientId: tempClient.id },
            data: { clientId: id },
          });
          await tx.futureTattooIdea.updateMany({
            where: { clientId: tempClient.id },
            data: { clientId: id },
          });
          await tx.storedFile.updateMany({
            where: { clientId: tempClient.id },
            data: { clientId: id },
          });
          await tx.client.update({
            where: { id: tempClient.id },
            data: { userId: null, isAnonymized: true, fullName: "Cadastro unificado" },
          });
        }

        await tx.client.update({
          where: { id },
          data: {
            userId: linkReq.userId,
            lgpdConsentAt: new Date(),
            identityVerificationCode: null,
          },
        });

        await tx.clientLinkRequest.update({
          where: { id: linkReq.id },
          data: {
            status: "APPROVED",
            reviewedByUserId: user.id,
            reviewedAt: new Date(),
            notes: parsed.data.notes || "Identidade verificada pela administradora.",
          },
        });
      });

      await recordAuditLog({
        actorUserId: user.id,
        action: "CLIENT_LINK_APPROVED",
        entityType: "Client",
        entityId: id,
        after: { linkedUserId: linkReq.userId },
      });

      return NextResponse.json({ ok: true, status: "APPROVED" });
    }

    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao processar ação no prontuário." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdminApi("clients");
    const { id } = await context.params;

    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.client.findUnique({
        where: { id },
        select: {
          id: true,
          fullName: true,
          userId: true,
          user: { select: { id: true, role: true } },
        },
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      const [appts, projects] = await Promise.all([
        tx.appointment.findMany({
          where: { clientId: id },
          select: { id: true },
        }),
        tx.tattooProject.findMany({
          where: { clientId: id },
          select: { id: true },
        }),
      ]);
      const appointmentIds = appts.map((a) => a.id);
      const projectIds = projects.map((p) => p.id);

      if (appointmentIds.length > 0 || projectIds.length > 0) {
        await tx.financialTransaction.updateMany({
          where: {
            OR: [
              ...(appointmentIds.length > 0
                ? [{ appointmentId: { in: appointmentIds } }]
                : []),
              ...(projectIds.length > 0
                ? [{ projectId: { in: projectIds } }]
                : []),
            ],
          },
          data: { appointmentId: null, projectId: null, paymentId: null },
        });
        await tx.stockMovement.updateMany({
          where: {
            OR: [
              ...(appointmentIds.length > 0
                ? [{ appointmentId: { in: appointmentIds } }]
                : []),
              ...(projectIds.length > 0
                ? [{ projectId: { in: projectIds } }]
                : []),
            ],
          },
          data: { appointmentId: null, projectId: null },
        });
      }

      await tx.documentSignature.deleteMany({ where: { clientId: id } });
      await tx.payment.deleteMany({ where: { clientId: id } });
      if (appointmentIds.length > 0) {
        await tx.appointmentHistory.deleteMany({
          where: { appointmentId: { in: appointmentIds } },
        });
      }
      await tx.appointment.deleteMany({ where: { clientId: id } });
      await tx.quoteRequest.deleteMany({ where: { clientId: id } });
      await tx.aftercareEntry.deleteMany({ where: { clientId: id } });
      await tx.tattooPassport.deleteMany({ where: { clientId: id } });
      if (projectIds.length > 0) {
        await tx.projectMedia.deleteMany({
          where: { projectId: { in: projectIds } },
        });
      }
      await tx.tattooProject.deleteMany({ where: { clientId: id } });
      await tx.clientLinkRequest.deleteMany({ where: { targetClientId: id } });
      await tx.clientNote.deleteMany({ where: { clientId: id } });
      await tx.futureTattooIdea.deleteMany({ where: { clientId: id } });
      await tx.referral.deleteMany({ where: { referrerClientId: id } });
      await tx.referral.updateMany({
        where: { referredClientId: id },
        data: { referredClientId: null },
      });
      await tx.exclusiveFlashDesign.updateMany({
        where: { reservedClientId: id },
        data: { reservedClientId: null },
      });
      await tx.waitlistEntry.updateMany({
        where: { clientId: id },
        data: { clientId: null },
      });
      await tx.storedFile.updateMany({
        where: { clientId: id },
        data: { clientId: null },
      });
      await tx.lgpdRequest.updateMany({
        where: { clientId: id },
        data: { clientId: null },
      });

      await tx.client.delete({ where: { id } });

      if (existing.userId && existing.user?.role === "CLIENT") {
        await tx.authSession.deleteMany({ where: { userId: existing.userId } });
        await tx.passwordResetToken.deleteMany({
          where: { userId: existing.userId },
        });
        await tx.notification.deleteMany({
          where: { recipientUserId: existing.userId },
        });
        await tx.reminder.deleteMany({ where: { userId: existing.userId } });
        await tx.clientLinkRequest.deleteMany({
          where: { userId: existing.userId },
        });
        await tx.lgpdRequest.updateMany({
          where: { userId: existing.userId },
          data: { userId: null },
        });
        await tx.auditLog.updateMany({
          where: { actorUserId: existing.userId },
          data: { actorUserId: null },
        });
        await tx.user.delete({ where: { id: existing.userId } });
      }

      return existing;
    });

    await recordAuditLog({
      actorUserId: adminUser.id,
      action: "CLIENT_DELETED",
      entityType: "Client",
      entityId: id,
      before: { fullName: deleted.fullName },
    });

    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Cliente não encontrado." },
        { status: 404 }
      );
    }
    console.error("[DELETE /api/admin/clients/[id]]", err);
    return NextResponse.json(
      { error: "Erro ao excluir cliente." },
      { status: 500 }
    );
  }
}
