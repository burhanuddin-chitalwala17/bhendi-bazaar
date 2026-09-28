import sharp from "sharp";
import { DomainError } from "@server/shared/domain-error";
import { MAX_IMAGE_EDGE } from "@server/catalog/media";
import { PROPOSAL_MIME } from "@server/content/enhancement.types";
import { SCENE_ASPECT_RATIO, type ScenePreset } from "@server/content/scene-presets";
import type { Segmenter } from "@server/content/providers/segment";
import type { ScenePainter } from "@server/content/providers/scene";
import { cutOutProduct } from "@server/content/tools/cutout";
import { centreIn, contentBox, fitInto, type Box } from "@server/content/tools/backdrop";
import { assertProductPixelsKept } from "@server/content/tools/pixel-identity";
import { WEBP_QUALITY, type ToolInput, type ToolResult } from "@server/content/tools/tool";

/**
 * The product in a real-looking setting (image-enhancement spec R1, R4, A3; trd D2, D4).
 *
 * Three steps, and the order is the whole point: cut the product out ourselves, ask the service
 * for a **setting** around it, then paste our own cut-out back over what came home and compare it
 * pixel for pixel before anything is encoded. What the service returns is treated as a backdrop
 * and nothing more — no service is trusted to keep a logo's letters or a bottle's shape, so if it
 * redrew the product its version is covered by ours, and if it moved ours the check fails the run.
 *
 * Every margin here is `backdrop.ts`'s, the same ones `white` and `studio` place against: a
 * second set of numbers for the same idea is how "make the product a little bigger" becomes a
 * hunt through three files.
 */

/**
 * The canvas the preset asks for: its aspect at the painted scene's own resolution, never past
 * the stored ceiling (ADR-0026). Taking the size from what came back rather than fixing one
 * avoids enlarging a backdrop the service drew small, which buys nothing but bytes.
 */
export function sceneCanvas(preset: ScenePreset, painted: Box): Box {
  const ratio = SCENE_ASPECT_RATIO[preset.aspect];
  const longEdge = Math.min(MAX_IMAGE_EDGE, Math.max(painted.width, painted.height));
  return ratio >= 1
    ? { width: longEdge, height: Math.max(1, Math.round(longEdge / ratio)) }
    : { width: Math.max(1, Math.round(longEdge * ratio)), height: longEdge };
}

export async function inScene(
  input: ToolInput,
  segmenter: Segmenter,
  painter: ScenePainter,
  preset: ScenePreset,
): Promise<ToolResult> {
  const cutout = await cutOutProduct(input, segmenter);
  const painted = await painter.paint({ cutout: cutout.bytes, prompt: preset.prompt, aspect: preset.aspect });

  const metadata = await sharp(painted).metadata().catch((cause: unknown) => {
    throw new DomainError("The scene came back as something we could not read", { cause });
  });
  if (!metadata.width || !metadata.height) {
    throw new DomainError("The scene came back as something we could not read");
  }

  const canvas = sceneCanvas(preset, { width: metadata.width, height: metadata.height });
  const placed = await fitInto(cutout.bytes, contentBox(canvas));
  // Centred: the service is told nothing about placement, and a placement we did not choose is
  // one we could not check the product against afterwards (trd D4).
  const at = centreIn(canvas, placed.width, placed.height);

  const composed = await sharp(painted)
    // `cover` rather than `fill`: the setting is cropped to our shape, never stretched into it.
    .resize({ width: canvas.width, height: canvas.height, fit: "cover" })
    .composite([{ input: placed.bytes, left: at.left, top: at.top }])
    .removeAlpha()
    .png()
    .toBuffer();
  await assertProductPixelsKept(placed.bytes, composed, at);

  const { data, info } = await sharp(composed).webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
  return { output: data, mimeType: PROPOSAL_MIME.WEBP, width: info.width, height: info.height };
}
