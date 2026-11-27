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

const createClientSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo do cliente."),
  phone: z.string().trim().min(8, "Informe o telefone."),
  whatsapp: z.string().trim().min(8, "Informe o WhatsApp."),
  email: z.string().trim().email("E-mail inválido.").optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  preferredStyles: z.array(z.string()).optional().default([]),
  allergiesSummary: z.string().trim().optional(),
  initialPrivateNote: z.string().trim().optional(),
  generateVerificationCode: z.boolean().optional().default(true),
});

export async function GET(request: Request) {
  try {
    await requireAdminApi("clients");
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";

    const [clients, linkRequests] = await Promise.all([
      prisma.client.findMany({
        where: {
          isAnonymized: false,
          ...(q
            ? {
                OR: [
                  { fullName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { whatsapp: { contains: q, mode: "insensitive" } },
                  { phone: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { fullName: "asc" },
        include: {
          _count: {
            select: {
              appointments: true,
              projects: true,
              quoteRequests: true,
              documentSignatures: true,
            },
          },
        },
      }),
      prisma.clientLinkRequest.findMany({
        where: { status: "PENDING" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          targetClient: {
            select: { id: true, fullName: true, whatsapp: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ clients, linkRequests });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao listar clientes." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminApi("clients");
    const body = await request.json().catch(() => null);
    const parsed = createClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const verificationCode = d.generateVerificationCode
      ? `ZN-${crypto.randomBytes(2).toString("hex").toUpperCase()}`
      : null;

    const birthDateParsed = d.birthDate
      ? new Date(`${d.birthDate.slice(0, 10)}T00:00:00.000Z`)
      : null;

    const client = await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          fullName: d.fullName,
          phone: d.phone,
          whatsapp: d.whatsapp,
          email: d.email ? d.email.toLowerCase() : null,
          birthDate:
            birthDateParsed && !Number.isNaN(birthDateParsed.getTime())
              ? birthDateParsed
              : null,
          preferredStyles: d.preferredStyles,
          allergiesSummary: d.allergiesSummary || null,
          identityVerificationCode: verificationCode,
        },
      });

      if (d.initialPrivateNote) {
        await tx.clientNote.create({
          data: {
            clientId: created.id,
            authorUserId: user.id,
            content: d.initialPrivateNote,
            isPrivate: true,
          },
        });
      }

      return created;
    });

    await recordAuditLog({
      actorUserId: user.id,
      action: "CLIENT_CREATED_MANUAL",
      entityType: "Client",
      entityId: client.id,
      after: { fullName: client.fullName },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao cadastrar cliente." },
      { status: 500 }
    );
  }
}
