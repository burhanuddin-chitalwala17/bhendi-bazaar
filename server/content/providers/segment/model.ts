import { DomainError } from "@server/shared/domain-error";
import { ENHANCEMENT_PROVIDER } from "@server/content/enhancement.types";
import { fetchPicture, modelApiKey, modelEndpoint } from "@server/content/providers/model-host";
import {
  SEGMENT_FAILED_MESSAGE,
  SEGMENT_TIMEOUT_MS,
  type SegmentInput,
  type Segmenter,
  type StoreUrls,
} from "@server/content/providers/segment";

/**
 * A hosted vision model that answers with a cut-out (image-enhancement trd D3). Plain `fetch` and no
 * SDK; the key and the host it goes to are the same two the scene painter uses and are declared
 * once in `model-host.ts`.
 */
const SEGMENT_PATH = "/fal-ai/birefnet";

/** What the model answers with: a link to the picture it made. Anything else is a failure. */
function cutOutUrlOf(payload: unknown): string | null {
  const image = (payload as { image?: { url?: unknown } } | null)?.image;
  return typeof image?.url === "string" && image.url.length > 0 ? image.url : null;
}

export function modelSegmenter(urls: StoreUrls): Segmenter {
  return {
    key: ENHANCEMENT_PROVIDER.MODEL,

    /** A key is the whole of the configuration: with one this works anywhere, without one nowhere. */
    isAvailable() {
      return modelApiKey() !== undefined;
    },

    async cutOut(input: SegmentInput): Promise<Buffer> {
      const key = modelApiKey();
      if (!key || !input.objectKey) throw new DomainError(SEGMENT_FAILED_MESSAGE);

      const answer = await fetch(`${modelEndpoint()}${SEGMENT_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Key ${key}` },
        body: JSON.stringify({ image_url: urls.urlOf(input.objectKey) }),
        signal: AbortSignal.timeout(SEGMENT_TIMEOUT_MS),
      }).catch((cause: unknown) => {
        throw new DomainError(SEGMENT_FAILED_MESSAGE, { cause });
      });
      if (!answer.ok) throw new DomainError(SEGMENT_FAILED_MESSAGE, { cause: answer.status });

      const cutOutUrl = cutOutUrlOf(await answer.json().catch(() => null));
      if (!cutOutUrl) throw new DomainError(SEGMENT_FAILED_MESSAGE);

      // The answer is a link, not the bytes: one more fetch, bounded the same way.
      return await fetchPicture(cutOutUrl, SEGMENT_TIMEOUT_MS, SEGMENT_FAILED_MESSAGE);
    },
  };
}
