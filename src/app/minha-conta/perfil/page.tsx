import { prisma } from "@/lib/prisma";
import { requireClientPage } from "@/lib/security/rbac";
import { ClientProfileClient } from "@/components/client/profile-client";

export const dynamic = "force-dynamic";

export default async function ClientPerfilPage() {
  const user = await requireClientPage();
  const client = user.clientId
    ? await prisma.client.findUnique({
        where: { id: user.clientId },
      })
    : null;

  return (
    <ClientProfileClient
      userId={user.id}
      role={user.role}
      initial={{
        fullName: client?.fullName || user.name,
        email: client?.email || user.email,
        whatsapp: client?.whatsapp || "",
        phone: client?.phone || "",
        birthDate: client?.birthDate
          ? client.birthDate.toISOString().slice(0, 10)
          : "",
        preferredStyles: client?.preferredStyles || [],
        marketingOptIn: client?.marketingOptIn ?? false,
      }}
    />
  );
}
