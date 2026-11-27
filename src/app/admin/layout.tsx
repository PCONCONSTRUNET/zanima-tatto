import React from "react";
import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/security/rbac";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/shells/admin-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "ZANIMA Admin",
    template: "%s | ZANIMA Admin",
  },
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ZANIMA Admin",
  },
};

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
