import { downscaleImage } from "@/lib/image/downscale";
import { imageFileProblem } from "@server/catalog/image-paths";
import { uploadDirect } from "@/lib/image/upload-direct";
import type { UploadEndpoints } from "@/lib/image/upload-endpoints";
import type { DerivedFromInput } from "@/lib/validation/schemas/upload.schema";

/** Bounded, not a stampede: a phone's radio and the presign route both prefer it. */
export const UPLOAD_CONCURRENCY = 3;

export interface UploadBatchOptions {
  endpoints: UploadEndpoints;
  /** The stored path for a prepared file — the caller knows the folder, the org and the name. */
  pathFor: (file: File) => string;
  onProgress?: (done: number, total: number) => void;
  concurrency?: number;
  /** Every file here is a crop of that asset, registered as derived from it (media-library trd D6a). */
  derivedFrom?: DerivedFromInput;
}

export interface UploadBatchResult {
  /** Index-aligned with the files given: the stored URL, or undefined where that file failed. */
  urls: (string | undefined)[];
  /** Index-aligned with `urls`: the asset behind each, or null where it failed or the route registers none. */
  assetIds: (string | null)[];
  /** The names of the files that did not land. */
  failed: string[];
  firstError: string | null;
  /** How many came back as an image the org already held (media-library D11). */
  reused: number;
}

/**
 * Several photographs, browser to store, the way every gallery and the library upload them
 * (ADR-0026, ADR-0028): each is downscaled and checked before any is sent, so a refused batch is
 * refused whole; then they go up a few at a time. A network failure part-way through cannot be
 * undone without deleting what already landed, so the successes are kept and the rest are named.
 */
export async function uploadBatch(files: File[], options: UploadBatchOptions): Promise<UploadBatchResult> {
  const concurrency = options.concurrency ?? UPLOAD_CONCURRENCY;
  const prepared: File[] = [];
  for (const file of files) {
    // Downscale first, then check: what was picked may be far larger than what we store, and a
    // file no decoder accepts comes back through unchanged, so the type is checked on the result.
    const ready = await downscaleImage(file);
    const problem = imageFileProblem(ready);
    if (problem) throw new Error(problem);
    prepared.push(ready);
  }

  const urls: (string | undefined)[] = new Array(prepared.length);
  const assetIds: (string | null)[] = new Array<string | null>(prepared.length).fill(null);
  const failed: string[] = [];
  let firstError: string | null = null;
  let reused = 0;
  let done = 0;
  const queue = prepared.map((file, index) => ({ file, index }));
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        const result = await uploadDirect(options.pathFor(job.file), job.file, options.endpoints, {
          derivedFrom: options.derivedFrom,
        });
        urls[job.index] = result.url;
        assetIds[job.index] = result.assetId;
        if (result.reused) reused += 1;
      } catch (error) {
        failed.push(files[job.index].name);
        firstError ??= error instanceof Error ? error.message : "Upload failed";
      }
      done += 1;
      options.onProgress?.(done, prepared.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, prepared.length) }, worker));
  return { urls, assetIds, failed, firstError, reused };
}
