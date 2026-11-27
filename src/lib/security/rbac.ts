import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type SafeSessionUser } from "@/lib/security/session";
import { FinancialContext } from "@prisma/client";

export class ForbiddenError extends Error {
  constructor(message = "Acesso negado.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Autenticação necessária.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireAuthApi(): Promise<SafeSessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireAdminApi(
  permissionKey?: string
): Promise<SafeSessionUser> {
  const user = await requireAuthApi();
  if (user.role !== "OWNER" && user.role !== "STAFF") {
    throw new ForbiddenError("Acesso restrito à equipe do estúdio.");
  }
  if (
    user.role === "STAFF" &&
    permissionKey &&
    user.permissions[permissionKey] !== true
  ) {
    throw new ForbiddenError("Permissão insuficiente para este módulo.");
  }
  return user;
}

export async function requireOwnerApi(): Promise<SafeSessionUser> {
  const user = await requireAuthApi();
  if (user.role !== "OWNER") {
    throw new ForbiddenError(
      "Acesso exclusivo da proprietária do estúdio."
    );
  }
  return user;
}

export function canAccessPersonalFinance(user: SafeSessionUser): boolean {
  return user.role === "OWNER";
}

export function assertFinancialContextAccess(
  user: SafeSessionUser,
  context: FinancialContext | "ALL"
): void {
  if (user.role !== "OWNER" && user.role !== "STAFF") {
    throw new ForbiddenError();
  }
  if (
    (context === FinancialContext.PERSONAL || context === "ALL") &&
    !canAccessPersonalFinance(user)
  ) {
    throw new ForbiddenError(
      "As finanças pessoais são acessíveis exclusivamente pela proprietária."
    );
  }
}

export async function requireAdminPage(): Promise<SafeSessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/admin");
  if (user.role !== "OWNER" && user.role !== "STAFF") {
    redirect("/minha-conta");
  }
  return user;
}

export async function requireClientPage(): Promise<SafeSessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/minha-conta");
  if (!user.clientId && user.role === "CLIENT") {
    redirect("/entrar");
  }
  return user;
}
