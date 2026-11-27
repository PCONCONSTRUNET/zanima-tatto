import "server-only";
import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { generateOpaqueToken, sha256Hex } from "@/lib/security/password";
import type { ThemePreference, UserRole } from "@prisma/client";

export const SESSION_COOKIE_NAME = "zanima_session";
const SESSION_TTL_DAYS = 14;

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 24) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SESSION_SECRET não configurada com tamanho seguro.");
    }
    return "zanima-dev-fallback-secret-change-in-prod-2026";
  }
  return secret;
}

function signToken(rawToken: string): string {
  const mac = crypto
    .createHmac("sha256", getSessionSecret())
    .update(rawToken)
    .digest("base64url");
  return `${rawToken}.${mac}`;
}

function verifySignedToken(cookieValue: string): string | null {
  const dotIdx = cookieValue.lastIndexOf(".");
  if (dotIdx <= 0) return null;
  const rawToken = cookieValue.slice(0, dotIdx);
  const providedMac = cookieValue.slice(dotIdx + 1);
  const expectedMac = crypto
    .createHmac("sha256", getSessionSecret())
    .update(rawToken)
    .digest("base64url");
  const a = Buffer.from(providedMac);
  const b = Buffer.from(expectedMac);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  return rawToken;
}

export interface SafeSessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: Record<string, boolean>;
  themePreference: ThemePreference;
  hideFinancialValues: boolean;
  clientId: string | null;
}

export async function getClientIpAndAgent(): Promise<{
  ipAddress: string;
  userAgent: string;
}> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ipAddress =
    forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const userAgent = (h.get("user-agent") || "unknown").slice(0, 280);
  return { ipAddress, userAgent };
}

export async function createAuthSession(userId: string): Promise<void> {
  const rawToken = generateOpaqueToken(32);
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  );
  const { ipAddress, userAgent } = await getClientIpAndAgent();

  await prisma.$transaction([
    prisma.authSession.create({
      data: {
        userId,
        tokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signToken(rawToken), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (value) {
    const rawToken = verifySignedToken(value);
    if (rawToken) {
      await prisma.authSession
        .deleteMany({ where: { tokenHash: sha256Hex(rawToken) } })
        .catch(() => {});
    }
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export const getCurrentUser = cache(
  async (): Promise<SafeSessionUser | null> => {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!cookieVal) return null;

    const rawToken = verifySignedToken(cookieVal);
    if (!rawToken) return null;

    let session = null;
    try {
      session = await prisma.authSession.findUnique({
        where: { tokenHash: sha256Hex(rawToken) },
        select: {
          expiresAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              permissions: true,
              themePreference: true,
              hideFinancialValues: true,
              active: true,
              clientProfile: {
                select: { id: true },
              },
            },
          },
        },
      });
    } catch {
      return null;
    }

    if (!session || session.expiresAt < new Date() || !session.user.active) {
      return null;
    }

    const perms =
      typeof session.user.permissions === "object" &&
      session.user.permissions !== null &&
      !Array.isArray(session.user.permissions)
        ? (session.user.permissions as Record<string, boolean>)
        : {};

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      permissions: perms,
      themePreference: session.user.themePreference,
      hideFinancialValues: session.user.hideFinancialValues,
      clientId: session.user.clientProfile?.id ?? null,
    };
  }
);
