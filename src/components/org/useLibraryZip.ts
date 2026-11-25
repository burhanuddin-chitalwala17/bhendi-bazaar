import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api-error";
import { saveBlob } from "@/lib/browser-navigation";
import { NO_FILE_REASON, ZIP_LIMIT_BYTES, type MediaDownloadLinksDto } from "@server/catalog/media-library.types";
import { MEDIA_BULK_MAX_IDS } from "@/lib/validation/schemas/media-library.schema";
import { mediaFilesApiClient } from "./mediaFilesApiClient";
import { orgMediaApiClient } from "./orgMediaApiClient";

/** What was left out before any fetch: YouTube links, swept files, and ids no longer this shop's. */
interface LeftOut {
  links: number;
  deleted: number;
  gone: number;
}

/** The selection bar turns each into ux copy; `failedIds` is what "Try those {n} again" sends (Q13). */
export type LibraryZipOutcome =
  | ({ kind: "saved"; saved: number; total: number; failedIds: string[] } & LeftOut)
  | ({ kind: "noneFetched"; failedIds: string[] } & LeftOut)
  | ({ kind: "nothingToZip" } & LeftOut)
  /** `totalBytes` is null when the real bytes passed the limit mid-fetch: the true total is unknown. */
  | { kind: "tooBig"; totalBytes: number | null; limitBytes: number }
  | { kind: "error" }
  | { kind: "cancelled" };

/** `total` is the selection while links are asked for, then the files being fetched. */
export interface ZipProgress {
  done: number;
  total: number;
}

/** `<shop code>-library-<local date>.zip` (Q11). */
export function libraryZipName(shopCode: string | null, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const name = shopCode ? `${shopCode}-library-${date}` : `library-${date}`;
  return `${name.replace(/[^A-Za-z0-9._-]/g, "-")}.zip`;
}

/** Files fetched on one round of links, which the server signs for 15 minutes (Q20, trd D4). */
const LINK_BATCH = 10;
/** A link this old is asked for again before its file is fetched: a slow file can outlast a batch's links. */
const LINK_STALE_MS = 10 * 60 * 1000;

/**
 * The link for each file, signed shortly before it is fetched (Q20). The first batch uses the links
 * the size check already brought; each later one asks again. A batch that can't be asked fails its files.
 */
function freshLinks(
  order: string[],
  first: { urls: Map<string, string>; at: number },
  ask: (ids: string[], signal: AbortSignal) => Promise<MediaDownloadLinksDto>,
) {
  // null: asked for, and no link came back.
  const held = new Map<string, { url: string; at: number } | null>();
  for (const id of order.slice(0, LINK_BATCH)) held.set(id, { url: first.urls.get(id)!, at: first.at });
  return async (id: string, signal: AbortSignal): Promise<string> => {
    const link = held.get(id);
    if (link === undefined || (link && Date.now() - link.at > LINK_STALE_MS)) {
      const from = order.indexOf(id);
      const batch = order.slice(from, from + LINK_BATCH);
      const at = Date.now();
      const before = batch.map((asked) => [asked, held.get(asked)] as const);
      for (const asked of batch) held.set(asked, null);
      try {
        const answer = await ask(batch, signal);
        for (const file of answer.files) held.set(file.id, { url: file.url, at });
      } catch (error) {
        if (signal.aborted) throw error;
        // An aged link may still be inside its 15 minutes: better tried than failed unasked.
        for (const [asked, old] of before) if (old) held.set(asked, old);
      }
    }
    const url = held.get(id)?.url;
    if (!url) throw new Error("No link for this file");
    return url;
  };
}

function tooBigFrom(error: unknown): LibraryZipOutcome | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;
  const detail = (path: string) => Number(error.details.find((d) => d.path === path)?.message);
  const totalBytes = detail("totalBytes");
  const limitBytes = detail("limitBytes");
  return Number.isFinite(totalBytes) && Number.isFinite(limitBytes) ? { kind: "tooBig", totalBytes, limitBytes } : null;
}

/**
 * Builds and saves one zip of a Library selection (bulk-actions trd D6, D7): holds its progress and
 * its cancel. It never toasts; the caller reads the outcome. A second call while building joins it.
 */
export function useLibraryZip(orgId: string, shopCode: string | null, limitBytes: number = ZIP_LIMIT_BYTES) {
  const [progress, setProgress] = useState<ZipProgress | null>(null);
  const controller = useRef<AbortController | null>(null);
  const running = useRef<Promise<LibraryZipOutcome> | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const build = useCallback(
    async (ids: string[], abort: AbortController): Promise<LibraryZipOutcome> => {
      setProgress({ done: 0, total: ids.length });
      // At most 100 ids a request (Q10); each batch is capped by the server, their sum here (Q4).
      const links: MediaDownloadLinksDto = { files: [], noFile: [], totalBytes: 0 };
      const signedAt = Date.now();
      try {
        for (let at = 0; at < ids.length; at += MEDIA_BULK_MAX_IDS) {
          const batch = await orgMediaApiClient.downloadLinks(orgId, ids.slice(at, at + MEDIA_BULK_MAX_IDS), abort.signal);
          links.files.push(...batch.files);
          links.noFile.push(...batch.noFile);
          links.totalBytes += batch.totalBytes;
          if (abort.signal.aborted) return { kind: "cancelled" };
        }
      } catch (error) {
        if (abort.signal.aborted) return { kind: "cancelled" };
        const tooBig = tooBigFrom(error);
        // One batch's total would understate the selection once earlier batches counted.
        if (tooBig?.kind === "tooBig" && links.files.length + links.noFile.length > 0) return { ...tooBig, totalBytes: null };
        return tooBig ?? { kind: "error" };
      }
      if (abort.signal.aborted) return { kind: "cancelled" };
      if (links.totalBytes > limitBytes) return { kind: "tooBig", totalBytes: links.totalBytes, limitBytes };

      const known = new Set([...links.files, ...links.noFile].map((item) => item.id));
      const leftOut: LeftOut = {
        links: links.noFile.filter((item) => item.reason === NO_FILE_REASON.LINK).length,
        deleted: links.noFile.filter((item) => item.reason === NO_FILE_REASON.DELETED).length,
        gone: ids.filter((id) => !known.has(id)).length,
      };
      if (!links.files.length) return { kind: "nothingToZip", ...leftOut };

      const linkFor = freshLinks(
        links.files.map((file) => file.id),
        { urls: new Map(links.files.map((file) => [file.id, file.url])), at: signedAt },
        (batch, signal) => orgMediaApiClient.downloadLinks(orgId, batch, signal),
      );
      setProgress({ done: 0, total: links.files.length });
      // fflate loads on the first Download, not with the Library (trd Packages).
      let zipModule;
      try {
        zipModule = await import("@/lib/zip/build-zip");
      } catch {
        return { kind: "error" };
      }
      const { buildZip, ZipLimitError } = zipModule;
      try {
        const zip = await buildZip(links.files, {
          open: async (entry, signal) => mediaFilesApiClient.open(await linkFor(entry.id, signal), signal),
          limitBytes,
          signal: abort.signal,
          onProgress: (done, total) => setProgress({ done, total }),
        });
        if (!zip.blob) return { kind: "noneFetched", failedIds: zip.failed, ...leftOut };
        saveBlob(zip.blob, libraryZipName(shopCode, new Date()));
        return { kind: "saved", saved: zip.added.length, total: links.files.length, failedIds: zip.failed, ...leftOut };
      } catch (error) {
        if (abort.signal.aborted) return { kind: "cancelled" };
        if (error instanceof ZipLimitError) return { kind: "tooBig", totalBytes: null, limitBytes: error.limitBytes };
        return { kind: "error" };
      }
    },
    [orgId, shopCode, limitBytes],
  );

  const download = useCallback(
    (ids: string[]): Promise<LibraryZipOutcome> => {
      if (running.current) return running.current;
      const abort = new AbortController();
      controller.current = abort;
      const settled = build(ids, abort).finally(() => {
        running.current = null;
        controller.current = null;
        setProgress(null);
      });
      running.current = settled;
      return settled;
    },
    [build],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);

  return { download, cancel, progress };
}
