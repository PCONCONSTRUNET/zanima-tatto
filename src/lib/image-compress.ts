"use client";

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
}

const SKIP_COMPRESS_TYPES = new Set([
  "image/gif",
  "image/svg+xml",
]);

function replaceExtension(name: string, ext: string): string {
  const clean = (name || "imagem").replace(/\.[^/.]+$/, "");
  return `${clean}.${ext}`;
}

async function decodeImage(
  file: File
): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      close: () => bitmap.close(),
    };
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        close: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("IMAGE_DECODE_FAILED"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Comprime imagens no navegador via Canvas + Blob binário (nunca gera base64).
 * Arquivos não-imagem (como PDF) são retornados sem alteração.
 */
export async function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/") || SKIP_COMPRESS_TYPES.has(file.type)) {
    return file;
  }

  const maxDimension = options.maxDimension ?? 1600;
  const quality = options.quality ?? 0.84;

  try {
    const decoded = await decodeImage(file);
    try {
      const { width, height } = decoded;
      if (!width || !height) return file;

      const scale = Math.min(1, maxDimension / Math.max(width, height));
      const targetW = Math.max(1, Math.round(width * scale));
      const targetH = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext("2d");
      if (!ctx) return file;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      decoded.draw(ctx, targetW, targetH);

      // Tenta WebP primeiro (ótimo tamanho e suporta transparência); fallback para JPEG
      let blob = await canvasToBlob(canvas, "image/webp", quality);
      let outputMime = "image/webp";
      let outputExt = "webp";

      if (!blob || blob.type !== "image/webp") {
        blob = await canvasToBlob(canvas, "image/jpeg", quality);
        outputMime = "image/jpeg";
        outputExt = "jpg";
      }

      if (!blob) return file;

      // Se não reduziu tamanho (ex: imagem já muito leve), mantém original
      if (blob.size >= file.size && scale === 1) {
        return file;
      }

      return new File([blob], replaceExtension(file.name, outputExt), {
        type: outputMime,
        lastModified: Date.now(),
      });
    } finally {
      decoded.close?.();
    }
  } catch {
    return file;
  }
}

export async function compressImageFiles(
  files: FileList | File[],
  maxCount?: number,
  options?: CompressOptions
): Promise<File[]> {
  const list = Array.from(files);
  const sliced = typeof maxCount === "number" ? list.slice(0, maxCount) : list;
  return Promise.all(sliced.map((f) => compressImageFile(f, options)));
}
