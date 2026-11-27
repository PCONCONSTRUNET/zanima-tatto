import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/password";
import {
  createAuthSession,
  getClientIpAndAgent,
} from "@/lib/security/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { recordAuditLog } from "@/lib/security/audit";
import { notifyStudioAdmins } from "@/lib/notifications";

const registerSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome completo."),
  email: z.string().trim().email("Informe um e-mail válido."),
  whatsapp: z.string().trim().min(8, "Informe seu WhatsApp com DDD."),
  phone: z.string().trim().optional(),
  birthDate: z.string().optional(),
  verificationCode: z.string().trim().optional(),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.")
    .regex(/[a-zA-Z]/, "A senha deve conter ao menos uma letra.")
    .regex(/[0-9]/, "A senha deve conter ao menos um número."),
  lgpdConsent: z.literal(true, {
    error: "É necessário concordar com a Política de Privacidade (LGPD).",
  }),
  marketingOptIn: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const { ipAddress } = await getClientIpAndAgent();
    const limit = checkRateLimit(`register:${ipAddress}`, 8, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `Muitas solicitações. Aguarde ${limit.retryAfterSeconds}s.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const email = data.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Já existe uma conta cadastrada com este e-mail." },
        { status: 409 }
      );
    }

    const cleanWhatsapp = data.whatsapp.replace(/\D/g, "");
    const passwordHash = await hashPassword(data.password);
    const birthDateParsed = data.birthDate
      ? new Date(`${data.birthDate.slice(0, 10)}T00:00:00.000Z`)
      : null;

    // Procura cadastro manual sem conta vinculada para verificação de identidade
    const manualMatch = await prisma.client.findFirst({
      where: {
        userId: null,
        isAnonymized: false,
        OR: [
          { email },
          ...(cleanWhatsapp.length >= 8
            ? [{ whatsapp: { contains: cleanWhatsapp.slice(-8) } }]
            : []),
        ],
      },
    });

    const codeMatches =
      Boolean(manualMatch?.identityVerificationCode) &&
      Boolean(data.verificationCode) &&
      manualMatch!.identityVerificationCode!.toUpperCase() ===
        data.verificationCode!.trim().toUpperCase();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.fullName,
          email,
          passwordHash,
          role: "CLIENT",
          themePreference: "DARK",
        },
      });

      let client;
      let linkPending = false;

      if (manualMatch && codeMatches) {
        // Código de verificação emitido pelo estúdio confere: vincula diretamente
        client = await tx.client.update({
          where: { id: manualMatch.id },
          data: {
            userId: user.id,
            email: manualMatch.email || email,
            marketingOptIn: data.marketingOptIn,
            lgpdConsentAt: new Date(),
            identityVerificationCode: null,
          },
        });
      } else {
        client = await tx.client.create({
          data: {
            userId: user.id,
            fullName: data.fullName,
            phone: data.phone || data.whatsapp,
            whatsapp: data.whatsapp,
            email,
            birthDate:
              birthDateParsed && !Number.isNaN(birthDateParsed.getTime())
                ? birthDateParsed
                : null,
            marketingOptIn: data.marketingOptIn,
            lgpdConsentAt: new Date(),
          },
        });

        if (manualMatch) {
          await tx.clientLinkRequest.create({
            data: {
              userId: user.id,
              targetClientId: manualMatch.id,
              providedEmail: email,
              providedPhone: data.whatsapp,
              providedBirthDate: data.birthDate || null,
              notes:
                "Correspondência automática detectada no cadastro; aguardando verificação da administradora.",
            },
          });
          linkPending = true;
        }
      }

      return { user, client, linkPending };
    });

    await createAuthSession(result.user.id);
    await recordAuditLog({
      actorUserId: result.user.id,
      action: "CLIENT_REGISTERED",
      entityType: "Client",
      entityId: result.client.id,
      after: { linkPending: result.linkPending },
      ipAddress,
    });

    if (result.linkPending) {
      await notifyStudioAdmins({
        eventType: "CLIENT_LINK_REQUEST",
        title: "Solicitação de vinculação de prontuário",
        body: `${data.fullName} criou conta e possui possível cadastro manual prévio aguardando verificação.`,
        linkUrl: "/admin/clientes",
      });
    }

    return NextResponse.json(
      {
        user: { id: result.user.id, name: result.user.name, role: "CLIENT" },
        linkPending: result.linkPending,
        redirectTo: "/minha-conta",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    return NextResponse.json(
      { error: "Não foi possível concluir o cadastro." },
      { status: 500 }
    );
  }
}
