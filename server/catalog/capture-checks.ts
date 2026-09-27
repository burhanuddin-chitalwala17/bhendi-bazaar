import { SHOT_ROLE, type ShotRole } from "@server/catalog/shot-list";
import { ENHANCEMENT_TOOL, type AvailableTool } from "@server/content/enhancement.types";

/**
 * The three capture checks a photo gets before it is kept (media-library R8, D6): darkness by
 * mean luminance, blur by Laplacian variance, size against the smallest marketplace minimum.
 * Pure — the browser hands in a small grey frame and the source's dimensions; nothing here
 * knows where the picture came from. Advisory copy, never a refusal.
 */

// Conventional starting points — ~60/255 reads as underexposed, a Laplacian variance under ~100
// as soft, 1000px is the smallest long edge any marketplace asks for. Calibrated on the org's
// first real photos (D6): no marketplace publishes a number, only "in focus and well-lit".
export const CAPTURE_THRESHOLDS = {
  darkMeanLuminance: 60,
  blurLaplacianVariance: 100,
  minLongEdgePx: 1000,
} as const;

export const CAPTURE_CHECK = { DARK: "dark", BLUR: "blur", SMALL: "small" } as const;
export type CaptureCheck = (typeof CAPTURE_CHECK)[keyof typeof CAPTURE_CHECK];

export interface CaptureWarning {
  check: CaptureCheck;
  message: string;
}

const MESSAGES: Record<CaptureCheck, string> = {
  [CAPTURE_CHECK.DARK]: "Looks dark — brighter light or a lamp helps",
  [CAPTURE_CHECK.BLUR]: "Looks blurred — hold still and tap the product to focus",
  [CAPTURE_CHECK.SMALL]: `Smaller than ${CAPTURE_THRESHOLDS.minLongEdgePx}px on its long side — marketplaces may reject it`,
};

/**
 * The improvement that answers a warning, where one exists (image-enhancement spec R6, and the
 * media-library R8 rule that a warning offers the fix rather than only the diagnosis). Declared
 * here, beside the checks, so the banner and any later surface read one map.
 *
 * Blur has none on purpose. No tool un-blurs a photograph, and offering one would be a lie the
 * org member pays a slot to find out about — the honest answer is to take the picture again.
 */
export const FIX_FOR_CHECK: Record<CaptureCheck, AvailableTool | null> = {
  [CAPTURE_CHECK.DARK]: ENHANCEMENT_TOOL.LIGHT,
  [CAPTURE_CHECK.BLUR]: null,
  [CAPTURE_CHECK.SMALL]: ENHANCEMENT_TOOL.ENLARGE,
};

/** The first warning with a fix, in the order they were raised; null where none of them has one. */
export function fixForWarnings(warnings: readonly CaptureWarning[]): AvailableTool | null {
  for (const warning of warnings) {
    const fix = FIX_FOR_CHECK[warning.check];
    if (fix) return fix;
  }
  return null;
}

/** One grey byte per pixel, row-major, as the browser reads it off a canvas or a test builds it. */
export type GrayFrame = Uint8ClampedArray | readonly number[];

export interface CaptureFrame {
  gray: GrayFrame;
  width: number;
  height: number;
  /** The picked file's own dimensions — the frame is a fixed-size downscale, so size is judged on these. */
  sourceWidth: number;
  sourceHeight: number;
}

const ALL_CHECKS: readonly CaptureCheck[] = [CAPTURE_CHECK.DARK, CAPTURE_CHECK.BLUR, CAPTURE_CHECK.SMALL];
const SIZE_ONLY: readonly CaptureCheck[] = [CAPTURE_CHECK.SMALL];

/**
 * Which checks a slot's role earns (D6). A lifestyle shot is the org member's creative choice, so
 * only size; a product or label shot, and a photo with no slot yet, get all three.
 */
export function checksForRole(role: ShotRole | null): readonly CaptureCheck[] {
  return role === SHOT_ROLE.LIFESTYLE ? SIZE_ONLY : ALL_CHECKS;
}

export function meanLuminance(gray: GrayFrame): number {
  if (gray.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < gray.length; i += 1) sum += gray[i];
  return sum / gray.length;
}

/**
 * Variance of the 3×3 Laplacian (4-neighbour kernel) over the interior pixels. A sharp frame has
 * edges, so its responses spread; a soft one is near-uniform and its variance collapses to zero.
 */
export function laplacianVariance(gray: GrayFrame, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  const count = (width - 2) * (height - 2);
  const responses = new Float64Array(count);
  let sum = 0;
  let index = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const centre = y * width + x;
      const response =
        4 * gray[centre] - gray[centre - 1] - gray[centre + 1] - gray[centre - width] - gray[centre + width];
      responses[index] = response;
      sum += response;
      index += 1;
    }
  }
  const mean = sum / count;
  let squares = 0;
  for (let i = 0; i < count; i += 1) squares += (responses[i] - mean) ** 2;
  return squares / count;
}

/** The warnings a frame earns for the role it is destined for. Empty means nothing to say. */
export function judgeCapture(input: CaptureFrame & { role: ShotRole | null }): CaptureWarning[] {
  const failed: CaptureCheck[] = [];
  for (const check of checksForRole(input.role)) {
    if (check === CAPTURE_CHECK.DARK && meanLuminance(input.gray) < CAPTURE_THRESHOLDS.darkMeanLuminance) {
      failed.push(check);
    } else if (
      check === CAPTURE_CHECK.BLUR &&
      laplacianVariance(input.gray, input.width, input.height) < CAPTURE_THRESHOLDS.blurLaplacianVariance
    ) {
      failed.push(check);
    } else if (
      check === CAPTURE_CHECK.SMALL &&
      Math.max(input.sourceWidth, input.sourceHeight) < CAPTURE_THRESHOLDS.minLongEdgePx
    ) {
      failed.push(check);
    }
  }
  return failed.map((check) => ({ check, message: MESSAGES[check] }));
}

/**
 * The same role rule applied to warnings already computed, so a photo judged before its slot was
 * known is re-read for the slot it lands in without touching the pixels again.
 */
export function warningsForRole(warnings: readonly CaptureWarning[], role: ShotRole | null): CaptureWarning[] {
  const allowed = checksForRole(role);
  return warnings.filter((warning) => allowed.includes(warning.check));
}
