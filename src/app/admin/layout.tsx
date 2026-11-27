import React from "react";
import { requireAdminPage } from "@/lib/security/rbac";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/shells/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdminPage();
  const unreadCount = await prisma.notification.count({
    where: { recipientUserId: user.id, channel: "IN_APP", status: "UNREAD" },
  });

  return (
    <AdminShell user={user} unreadNotifications={unreadCount}>
      {children}
    </AdminShell>
  );
}
