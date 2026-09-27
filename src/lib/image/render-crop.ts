import { MAX_IMAGE_EDGE } from "@server/catalog/media";
import { encodeCanvas } from "@/lib/image/downscale";
import { normaliseTransform, rotatedBounds, type CropTransform } from "@/lib/image/crop-transform";

/**
 * Draw the crop an org member framed (media-library R8a, trd D6a): the source turned by its
 * rotation, then the rectangle cut from the turned picture at the rectangle's own pixel size —
 * capped at the stored ceiling, which the source already respects — and encoded the way every
 * stored image is (ADR-0026). The source file is untouched; this is the second object D6a names.
 */
export async function renderCrop(file: File, transform: CropTransform): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    // Clamped again against the decoded size, which is the only size that is not a report.
    const { rotation, crop } = normaliseTransform(transform.crop, transform.rotation, bitmap.width, bitmap.height);
    const bounds = rotatedBounds(bitmap.width, bitmap.height, rotation);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(crop.width, crop.height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(crop.width * scale));
    canvas.height = Math.max(1, Math.round(crop.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not draw the crop");

    context.scale(scale, scale);
    // Place the turned picture so the rectangle's corner sits on the canvas origin, then turn it
    // about its own centre — which is where a quarter turn keeps the picture inside its box.
    context.translate(bounds.width / 2 - crop.x, bounds.height / 2 - crop.y);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

    const encoded = await encodeCanvas(canvas, `${file.name.replace(/\.[^.]*$/, "")}-crop`);
    if (!encoded) throw new Error("Could not encode the crop");
    return encoded;
  } finally {
    bitmap.close();
  }
}
