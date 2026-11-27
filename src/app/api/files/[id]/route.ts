import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/security/session";
import { readPrivateFileBytes } from "@/lib/storage/private-storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const file = await prisma.storedFile.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não encontrado." },
        { status: 404 }
      );
    }

    if (file.visibility !== "PUBLIC_PORTFOLIO") {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json(
          { error: "Autenticação necessária." },
          { status: 401 }
        );
      }
      const isAdmin = user.role === "OWNER" || user.role === "STAFF";
      const isOwnerClient =
        file.visibility === "CLIENT_OWNED" &&
        user.clientId &&
        file.clientId === user.clientId;

      if (!isAdmin && !isOwnerClient) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
    }

    const bytes = await readPrivateFileBytes(file.storageKey);

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `inline; filename="${file.originalName}"`,
        "Cache-Control":
          file.visibility === "PUBLIC_PORTFOLIO"
            ? "public, max-age=3600"
            : "private, no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[GET /api/files/[id]]", err);
    return NextResponse.json(
      { error: "Erro ao ler arquivo." },
      { status: 500 }
    );
  }
}
