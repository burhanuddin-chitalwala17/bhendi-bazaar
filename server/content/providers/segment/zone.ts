import { DomainError } from "@server/shared/domain-error";
import { ENHANCEMENT_PROVIDER } from "@server/content/enhancement.types";
import {
  SEGMENT_FAILED_MESSAGE,
  SEGMENT_TIMEOUT_MS,
  type SegmentInput,
  type Segmenter,
  type StoreUrls,
} from "@server/content/providers/segment";

/**
 * The image host our own pictures are already served from can cut a foreground out as part of a
 * delivery transform, so the request is a GET of a URL we can already build (image-enhancement
 * trd D3). Free to 5,000 a month, which is why it is the default.
 */
const TRANSFORM = "segment=foreground,format=png";
const TRANSFORM_PREFIX = "/cdn-cgi/image";

/**
 * The development bucket's own hostname, which serves objects but runs no transforms. A base on it
 * is the signal that this service cannot work here, so local development falls through to the other.
 */
const NO_TRANSFORMS_HOST_SUFFIX = ".r2.dev";

/** The transform URL for one stored key: the options go in front of the path the store spells. */
export function zoneCutOutUrl(urls: StoreUrls, objectKey: string): string {
  const url = new URL(urls.urlOf(objectKey));
  url.pathname = `${TRANSFORM_PREFIX}/${TRANSFORM}${url.pathname}`;
  return url.toString();
}

export function zoneSegmenter(urls: StoreUrls): Segmenter {
  return {
    key: ENHANCEMENT_PROVIDER.ZONE,

    isAvailable() {
      try {
        return !new URL(urls.base).hostname.endsWith(NO_TRANSFORMS_HOST_SUFFIX);
      } catch {
        return false;
      }
    },

    async cutOut(input: SegmentInput): Promise<Buffer> {
      // A READY photograph always has one; a caller holding loose bytes and no key must use the
      // other service, since this one transforms an object the host can fetch for itself.
      if (!input.objectKey) throw new DomainError(SEGMENT_FAILED_MESSAGE);

      const response = await fetch(zoneCutOutUrl(urls, input.objectKey), {
        signal: AbortSignal.timeout(SEGMENT_TIMEOUT_MS),
      }).catch((cause: unknown) => {
        throw new DomainError(SEGMENT_FAILED_MESSAGE, { cause });
      });
      if (!response.ok) throw new DomainError(SEGMENT_FAILED_MESSAGE, { cause: response.status });
      return Buffer.from(await response.arrayBuffer());
    },
  };
}
