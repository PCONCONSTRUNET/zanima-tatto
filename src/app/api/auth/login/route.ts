import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/security/password";
import {
  createAuthSession,
  getClientIpAndAgent,
} from "@/lib/security/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { recordAuditLog } from "@/lib/security/audit";

const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
  next: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { ipAddress } = await getClientIpAndAgent();
    const limit = checkRateLimit(`login:${ipAddress}`, 12, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `Muitas tentativas de acesso. Aguarde ${limit.retryAfterSeconds}s e tente novamente.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        active: true,
        themePreference: true,
      },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401 }
      );
    }

    await createAuthSession(user.id);
    await recordAuditLog({
      actorUserId: user.id,
      action: "USER_LOGIN",
      entityType: "User",
      entityId: user.id,
      ipAddress,
    });

    const isAdmin = user.role === "OWNER" || user.role === "STAFF";
    const defaultTarget = isAdmin ? "/admin" : "/minha-conta";
    const requestedNext = parsed.data.next;
    const safeNext =
      requestedNext &&
      requestedNext.startsWith("/") &&
      !requestedNext.startsWith("//") &&
      (isAdmin || !requestedNext.startsWith("/admin"))
        ? requestedNext
        : defaultTarget;

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        themePreference: user.themePreference,
      },
      redirectTo: safeNext,
    });
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json(
      { error: "Erro interno ao autenticar." },
      { status: 500 }
    );
  }
}
