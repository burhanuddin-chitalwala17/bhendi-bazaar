import { Zip, ZipPassThrough } from "fflate";

export interface ZipEntry {
  id: string;
  filename: string;
}

export interface BuildZipOptions {
  /** The bytes of one entry; must honour `signal`. */
  open: (entry: ZipEntry, signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>;
  /** Real bytes read, not sizes declared: a legacy row declares none (bulk-actions trd D4). */
  limitBytes: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export interface BuildZipResult {
  /** null when no entry arrived. */
  blob: Blob | null;
  added: string[];
  failed: string[];
}

export class ZipLimitError extends Error {
  constructor(
    readonly bytes: number,
    readonly limitBytes: number,
  ) {
    super(`The files came to more than ${limitBytes} bytes`);
    this.name = "ZipLimitError";
  }
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("", "AbortError");
}

/** Reads one entry whole, so a fetch failing halfway is skipped instead of leaving a truncated entry. */
async function readAll(
  stream: ReadableStream<Uint8Array>,
  room: number,
  limitBytes: number,
  readSoFar: number,
): Promise<Uint8Array[]> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return chunks;
      bytes += value.byteLength;
      if (bytes > room) throw new ZipLimitError(readSoFar + bytes, limitBytes);
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
}

/**
 * A stored (uncompressed) zip of `entries`, fetched one at a time (bulk-actions trd D6): photos and
 * videos are already compressed. Each file's output becomes a Blob as it is added, which the browser
 * may move out of the page, so memory peaks near one file rather than the whole zip twice (Q15).
 * Rejects with an AbortError on cancel and a ZipLimitError past the limit; a failed entry is skipped.
 */
export async function buildZip(entries: ZipEntry[], options: BuildZipOptions): Promise<BuildZipResult> {
  const { open, limitBytes, signal, onProgress } = options;
  let parts: Uint8Array[] = [];
  const pieces: Blob[] = [];
  const seal = () => {
    pieces.push(new Blob(parts as BlobPart[]));
    parts = [];
  };
  let zipError: Error | null = null;
  let ended = false;
  const zip = new Zip((error, chunk, final) => {
    if (error) zipError = error;
    else parts.push(chunk);
    if (final) ended = true;
  });

  const added: string[] = [];
  const failed: string[] = [];
  let bytes = 0;
  for (const entry of entries) {
    if (signal?.aborted) throw abortError(signal);
    const controller = new AbortController();
    const stopFetch = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", stopFetch);
    let chunks: Uint8Array[];
    try {
      chunks = await readAll(await open(entry, controller.signal), limitBytes - bytes, limitBytes, bytes);
    } catch (error) {
      if (signal?.aborted) throw abortError(signal);
      if (error instanceof ZipLimitError) throw error;
      failed.push(entry.id);
      onProgress?.(added.length + failed.length, entries.length);
      continue;
    } finally {
      signal?.removeEventListener("abort", stopFetch);
    }
    const file = new ZipPassThrough(entry.filename);
    zip.add(file);
    for (const chunk of chunks) {
      file.push(chunk);
      bytes += chunk.byteLength;
    }
    file.push(new Uint8Array(0), true);
    seal();
    added.push(entry.id);
    onProgress?.(added.length + failed.length, entries.length);
  }

  if (signal?.aborted) throw abortError(signal);
  if (!added.length) return { blob: null, added, failed };
  zip.end();
  // A stored entry and the trailer are emitted synchronously; either check failing is a fflate change.
  if (zipError) throw zipError;
  if (!ended) throw new Error("The zip did not finish");
  seal();
  return { blob: new Blob(pieces, { type: "application/zip" }), added, failed };
}
