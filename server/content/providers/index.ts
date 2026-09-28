import { DomainError } from "@server/shared/domain-error";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { ENHANCEMENT_PROVIDER, type EnhancementProvider } from "@server/content/enhancement.types";
import { zoneSegmenter } from "@server/content/providers/segment/zone";
import { modelSegmenter } from "@server/content/providers/segment/model";
import { modelScenePainter } from "@server/content/providers/scene/model";
import type { Segmenter, StoreUrls } from "@server/content/providers/segment";
import type { ScenePainter } from "@server/content/providers/scene";

/**
 * Which service performs a capability is configuration, and the other is the fallback (spec R8,
 * trd D3). The default is the image host we already pay for, so a deployment that sets nothing gets
 * the free one; setting the variable to the other service switches every run with no deploy and no
 * screen changing. An unrecognised value is the default, not a crash: this is a preference, and a
 * typo in it must not stop the shop improving a photograph.
 */
export const DEFAULT_SEGMENT_PROVIDER: EnhancementProvider = ENHANCEMENT_PROVIDER.ZONE;

/** Where the pictures are served from, which is all a service is told about the store (trd D9). */
function storeUrls(): StoreUrls {
  return { base: mediaAssetService.publicBaseUrl(), urlOf: mediaAssetService.publicUrlOf };
}

/**
 * The preferred service if it is set up, else the other, else a refusal the org member can read.
 * Availability is asked at the moment of use rather than at import, so a key added to the
 * environment takes effect on the next run.
 */
export function segmenterFor(preference: string = process.env.IMAGE_SEGMENT_PROVIDER ?? ""): Segmenter {
  const urls = storeUrls();
  const preferred = preference.trim().toLowerCase() === ENHANCEMENT_PROVIDER.MODEL
    ? ENHANCEMENT_PROVIDER.MODEL
    : DEFAULT_SEGMENT_PROVIDER;

  const candidates =
    preferred === ENHANCEMENT_PROVIDER.MODEL
      ? [modelSegmenter(urls), zoneSegmenter(urls)]
      : [zoneSegmenter(urls), modelSegmenter(urls)];

  const chosen = candidates.find((candidate) => candidate.isAvailable());
  if (!chosen) throw new DomainError("Background removal is not set up yet");
  return chosen;
}

/** Every segmenter that could run here, in preference order — what the bake-off compares (spec A6). */
export function availableSegmenters(): Segmenter[] {
  const urls = storeUrls();
  return [zoneSegmenter(urls), modelSegmenter(urls)].filter((candidate) => candidate.isAvailable());
}

/**
 * The service that paints a setting, or a refusal the org member can read (trd D3). There is no
 * preference to read: a scene has no free route, so there is one painter and the list it is found
 * in is what a second one joins. Asked at the moment of use, like the segmenters, so a key added
 * to the environment takes effect on the next run rather than on the next deploy.
 */
export function scenePainterFor(): ScenePainter {
  const chosen = [modelScenePainter()].find((candidate) => candidate.isAvailable());
  if (!chosen) throw new DomainError("Scene backdrops are not set up yet");
  return chosen;
}
