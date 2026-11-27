import React from "react";
import { requireClientPage } from "@/lib/security/rbac";
import { ClientShell } from "@/components/shells/client-shell";

export const dynamic = "force-dynamic";

export default async function ClientAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireClientPage();
  return <ClientShell user={user}>{children}</ClientShell>;
}
