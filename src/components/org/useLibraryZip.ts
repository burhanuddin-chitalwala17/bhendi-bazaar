import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api-error";
import { saveBlob } from "@/lib/browser-navigation";
import { buildZip, ZipLimitError } from "@/lib/zip/build-zip";
import { NO_FILE_REASON, ZIP_LIMIT_BYTES } from "@server/catalog/media-library.types";
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
  | { kind: "tooBig"; totalBytes: number; limitBytes: number }
  | { kind: "error" }
  | { kind: "cancelled" };

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
      let links;
      try {
        links = await orgMediaApiClient.downloadLinks(orgId, ids);
      } catch (error) {
        return tooBigFrom(error) ?? { kind: "error" };
      }
      if (abort.signal.aborted) return { kind: "cancelled" };

      const known = new Set([...links.files, ...links.noFile].map((item) => item.id));
      const leftOut: LeftOut = {
        links: links.noFile.filter((item) => item.reason === NO_FILE_REASON.LINK).length,
        deleted: links.noFile.filter((item) => item.reason === NO_FILE_REASON.DELETED).length,
        gone: ids.filter((id) => !known.has(id)).length,
      };
      if (!links.files.length) return { kind: "nothingToZip", ...leftOut };

      const urls = new Map(links.files.map((file) => [file.id, file.url]));
      setProgress({ done: 0, total: links.files.length });
      try {
        const zip = await buildZip(links.files, {
          open: (entry, signal) => mediaFilesApiClient.open(urls.get(entry.id)!, signal),
          limitBytes,
          signal: abort.signal,
          onProgress: (done, total) => setProgress({ done, total }),
        });
        if (!zip.blob) return { kind: "noneFetched", failedIds: zip.failed, ...leftOut };
        saveBlob(zip.blob, libraryZipName(shopCode, new Date()));
        return { kind: "saved", saved: zip.added.length, total: links.files.length, failedIds: zip.failed, ...leftOut };
      } catch (error) {
        if (abort.signal.aborted) return { kind: "cancelled" };
        if (error instanceof ZipLimitError) return { kind: "tooBig", totalBytes: error.bytes, limitBytes: error.limitBytes };
        throw error;
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
