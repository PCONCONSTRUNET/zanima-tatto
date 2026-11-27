import "server-only";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import type { FileVisibility } from "@prisma/client";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function getPrivateStorageRoot(): string {
  const configured = process.env.PRIVATE_STORAGE_DIR || "./storage/private";
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);
}

function detectMimeMagic(buffer: Buffer, declaredMime: string): boolean {
  if (buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (
    declaredMime === "image/jpeg" &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return true;
  }
  // PNG: 89 50 4E 47
  if (
    declaredMime === "image/png" &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }
  // WEBP: RIFF....WEBP
  if (
    declaredMime === "image/webp" &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.length >= 12 &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  // PDF: %PDF
  if (
    declaredMime === "application/pdf" &&
    buffer.subarray(0, 4).toString("ascii") === "%PDF"
  ) {
    return true;
  }
  return false;
}

function extensionFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    default:
      return ".bin";
  }
}

export async function savePrivateFile(params: {
  file: File;
  uploadedByUserId?: string | null;
  clientId?: string | null;
  visibility: FileVisibility;
}) {
  const { file, uploadedByUserId, clientId, visibility } = params;
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(
      "Formato de arquivo não permitido. Utilize JPG, PNG, WEBP ou PDF."
    );
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("O arquivo deve ter entre 1 byte e 10 MB.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!detectMimeMagic(buffer, file.type)) {
    throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
  }

  const root = getPrivateStorageRoot();
  await fs.mkdir(root, { recursive: true });

  const storageKey = `${crypto.randomUUID()}${extensionFromMime(file.type)}`;
  const targetPath = path.join(/*turbopackIgnore: true*/ root, path.basename(storageKey));

  await fs.writeFile(targetPath, buffer);

  const safeOriginalName = path
    .basename(file.name || "arquivo")
    .replace(/[^\w.\-()\s]/g, "_")
    .slice(0, 140);

  return prisma.storedFile.create({
    data: {
      uploadedByUserId: uploadedByUserId ?? null,
      clientId: clientId ?? null,
      storageKey,
      originalName: safeOriginalName,
      mimeType: file.type,
      sizeBytes: buffer.length,
      visibility,
    },
  });
}

export async function readPrivateFileBytes(
  storageKey: string
): Promise<Buffer> {
  const root = getPrivateStorageRoot();
  const safeKey = path.basename(storageKey);
  const fullPath = path.resolve(/*turbopackIgnore: true*/ root, safeKey);
  if (!fullPath.startsWith(root)) {
    throw new Error("Caminho de arquivo inválido.");
  }
  return fs.readFile(fullPath);
}

export async function deletePrivateFile(fileId: string): Promise<void> {
  const record = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!record) return;
  const root = getPrivateStorageRoot();
  const fullPath = path.resolve(/*turbopackIgnore: true*/ root, path.basename(record.storageKey));
  await fs.unlink(fullPath).catch(() => {});
  await prisma.storedFile.delete({ where: { id: fileId } }).catch(() => {});
}
