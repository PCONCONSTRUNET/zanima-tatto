import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  generateOpaqueToken,
  hashPassword,
  sha256Hex,
} from "@/lib/security/password";
import { getClientIpAndAgent } from "@/lib/security/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isChannelConfiguredByEnv } from "@/lib/notifications";
import { recordAuditLog } from "@/lib/security/audit";

const requestSchema = z.object({
  action: z.literal("request"),
  email: z.string().trim().email("Informe um e-mail válido."),
});

const confirmSchema = z.object({
  action: z.literal("confirm"),
  token: z.string().trim().min(16, "Token inválido."),
  newPassword: z
    .string()
    .min(8, "A nova senha deve ter ao menos 8 caracteres.")
    .regex(/[a-zA-Z]/, "Inclua ao menos uma letra.")
    .regex(/[0-9]/, "Inclua ao menos um número."),
});

export async function POST(request: Request) {
  try {
    const { ipAddress } = await getClientIpAndAgent();
    const limit = checkRateLimit(`pwreset:${ipAddress}`, 6, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Aguarde ${limit.retryAfterSeconds}s antes de tentar novamente.` },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (body?.action === "request") {
      const parsed = requestSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "E-mail inválido." },
          { status: 400 }
        );
      }

      const emailConfigured = isChannelConfiguredByEnv("EMAIL");
      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email.toLowerCase() },
        select: { id: true, active: true },
      });

      if (user && user.active && emailConfigured) {
        const rawToken = generateOpaqueToken(24);
        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: sha256Hex(rawToken),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });
      }

      if (!emailConfigured) {
        return NextResponse.json({
          emailConfigured: false,
          message:
            "O envio automático de e-mails ainda não está configurado neste servidor. Solicite à administradora do estúdio ZANIMA TATTOO a emissão de um link temporário de redefinição.",
        });
      }

      return NextResponse.json({
        emailConfigured: true,
        message:
          "Se existir uma conta ativa para este e-mail, as instruções de recuperação foram enfileiradas.",
      });
    }

    if (body?.action === "confirm") {
      const parsed = confirmSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Dados inválidos." },
          { status: 400 }
        );
      }

      const tokenHash = sha256Hex(parsed.data.token);
      const resetRecord = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
      });

      if (
        !resetRecord ||
        resetRecord.usedAt !== null ||
        resetRecord.expiresAt < new Date()
      ) {
        return NextResponse.json(
          { error: "Token de redefinição inválido ou expirado." },
          { status: 400 }
        );
      }

      const passwordHash = await hashPassword(parsed.data.newPassword);
      await prisma.$transaction([
        prisma.user.update({
          where: { id: resetRecord.userId },
          data: { passwordHash },
        }),
        prisma.passwordResetToken.update({
          where: { id: resetRecord.id },
          data: { usedAt: new Date() },
        }),
        prisma.authSession.deleteMany({
          where: { userId: resetRecord.userId },
        }),
      ]);

      await recordAuditLog({
        actorUserId: resetRecord.userId,
        action: "PASSWORD_RESET_COMPLETED",
        entityType: "User",
        entityId: resetRecord.userId,
        ipAddress,
      });

      return NextResponse.json({
        ok: true,
        message: "Senha atualizada com segurança. Faça login novamente.",
      });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/auth/password-reset]", err);
    return NextResponse.json(
      { error: "Erro ao processar recuperação de senha." },
      { status: 500 }
    );
  }
}
