import { IMAGE_QUALITY, MAX_IMAGE_EDGE } from "@server/catalog/media";

/**
 * Downscale and re-encode a picked file in the browser, before it is uploaded.
 *
 * The bulk wizard uploads browser-to-Blob directly (bulk-catalog-upload D10, to dodge
 * the 4.5MB function body cap), so the server-side normalisation in
 * server/catalog/image-upload.ts never sees these files. Without this, a bulk run stores
 * phone originals — which is most of how the free tier's transfer allowance went
 * (ADR-0026). Same budget as the server path, from the same module.
 *
 * Returns the original file untouched when it cannot be decoded or is already within
 * budget: a bulk run refusing a whole sheet over one odd image would be a worse failure
 * than storing that one as picked.
 */
/** `path` with its extension replaced by the uploaded file's, so the stored name
 *  describes the bytes rather than what was originally picked. */
export function storedPathFor(path: string, file: File): string {
  const dot = file.name.lastIndexOf(".");
  if (dot < 0) return path;
  const extension = file.name.slice(dot);
  return /\.[^./]*$/.test(path) ? path.replace(/\.[^./]*$/, extension) : path + extension;
}

/**
 * A canvas as the file we store: WebP at the one quality, named after the picked file with the
 * extension that describes the bytes. Null where the browser cannot encode WebP. The crop
 * renderer encodes through this too, so there is one answer to "what does a stored image look like".
 */
export async function encodeCanvas(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", IMAGE_QUALITY));
  if (!blob) return null;
  return new File([blob], `${name.replace(/\.[^.]*$/, "")}.webp`, { type: "image/webp" });
}

export async function downscaleImage(file: File): Promise<File> {
  // An animated GIF loses its animation on a canvas. Product photographs are not
  // animated, and the server path keeps animation for the ones that are.
  if (file.type === "image/gif") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    // Already within budget and already WebP: re-encoding would only lose quality.
    if (scale === 1 && file.type === "image/webp") return file;

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);

    const encoded = await encodeCanvas(canvas, file.name);
    if (!encoded || encoded.size >= file.size) return file;
    return encoded;
  } finally {
    bitmap.close();
  }
}
