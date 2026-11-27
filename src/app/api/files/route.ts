import { NextResponse } from "next/server";
import { requireAuthApi, UnauthorizedError } from "@/lib/security/rbac";
import { savePrivateFile } from "@/lib/storage/private-storage";
import type { FileVisibility } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const user = await requireAuthApi();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Nenhum arquivo válido enviado." },
        { status: 400 }
      );
    }

    const requestedVisibility = String(
      formData.get("visibility") || "CLIENT_OWNED"
    ) as FileVisibility;
    const requestedClientId = formData.get("clientId")
      ? String(formData.get("clientId"))
      : null;

    const isAdmin = user.role === "OWNER" || user.role === "STAFF";
    let visibility: FileVisibility = "CLIENT_OWNED";
    let clientId: string | null = user.clientId;

    if (isAdmin) {
      visibility =
        requestedVisibility === "PUBLIC_PORTFOLIO" ||
        requestedVisibility === "CLIENT_OWNED" ||
        requestedVisibility === "ADMIN_PRIVATE"
          ? requestedVisibility
          : "ADMIN_PRIVATE";
      clientId = requestedClientId;
    } else {
      // Clientes só podem enviar arquivos próprios (nunca publicar direto no portfólio)
      visibility = "CLIENT_OWNED";
      clientId = user.clientId;
    }

    const stored = await savePrivateFile({
      file,
      uploadedByUserId: user.id,
      clientId,
      visibility,
    });

    return NextResponse.json(
      {
        file: {
          id: stored.id,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          visibility: stored.visibility,
          url: `/api/files/${stored.id}`,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const message =
      err instanceof Error ? err.message : "Erro ao salvar arquivo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
