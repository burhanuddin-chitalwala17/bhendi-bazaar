import { TRANSFER_TIMEOUT_MS, withTimeout } from "@/lib/api-client";

/**
 * Reads a library file's bytes from a presigned bucket link (bulk-actions trd D5, D7). Not
 * `apiRequest`: the bucket is not our API and answers no envelope. Needs `GET` in the bucket's CORS.
 */
export const mediaFilesApiClient = {
  /** The timeout covers the body too, so a stalled file fails and the zip moves on (Q13). */
  async open(url: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(url, { signal: withTimeout(signal, TRANSFER_TIMEOUT_MS), credentials: "omit" });
    if (!response.ok || !response.body) throw new Error(`Couldn't fetch the file (${response.status})`);
    return response.body;
  },
};
