import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function recordAuditLog(params: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        beforeJson:
          params.before !== undefined
            ? (JSON.parse(JSON.stringify(params.before)) as Prisma.InputJsonValue)
            : undefined,
        afterJson:
          params.after !== undefined
            ? (JSON.parse(JSON.stringify(params.after)) as Prisma.InputJsonValue)
            : undefined,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[auditLog] Falha ao gravar log de auditoria:", err);
  }
}
