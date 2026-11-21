import { mediaAssetService } from "@server/catalog/media-asset.service";
import { generationRepository } from "@server/content/generation.repository";

/**
 * Delete what a finished run's model calls left under `generations/` (review, 2026-11-21): once the
 * picture is in the proposal or the library, no retry reads them again. Losing this costs a stray
 * object, never the run; the R2 expiry rule on the prefix is the backstop (OPERATIONS.md).
 */
export async function releaseGenerationOutputs(enhancementId: string): Promise<void> {
  try {
    const keys = await generationRepository.outputKeysForEnhancement(enhancementId);
    const results = await Promise.allSettled(keys.map((key) => mediaAssetService.deleteLooseObject(key)));
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed > 0) console.error(`[generation] ${failed} output(s) of ${enhancementId} not deleted`);
  } catch (error) {
    console.error(`[generation] outputs of ${enhancementId} not deleted`, error);
  }
}
