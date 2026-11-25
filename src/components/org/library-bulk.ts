import type { MediaAssetDto, MediaBulkRetireOutcome, MediaBulkTagOutcome } from "@server/catalog/media-library.types";
import { MEDIA_BULK_MAX_IDS } from "@/lib/validation/schemas/media-library.schema";
import type { LibraryZipOutcome } from "./useLibraryZip";
import { MEDIA_BULK_COPY as C } from "./media-library-copy";

/** What one bulk action tells the shop, as a toast (bulk-actions R6). `retry` re-sends `ids`. */
export interface BulkNotice {
  tone: "success" | "warning" | "error";
  title: string;
  description?: string;
  retry?: { label: string; ids: string[] };
}

const lines = (...parts: (string | false)[]) => parts.filter(Boolean).join(" ") || undefined;
const notice = (tone: BulkNotice["tone"], title: string, description?: string): BulkNotice =>
  description ? { tone, title, description } : { tone, title };

const MB = 1024 * 1024;
// Up for the size, so a selection just over the limit never reads as equal to it.
const sizeMb = (bytes: number) => `${Math.ceil(bytes / MB)} MB`;
const limitMb = (bytes: number) => `${Math.floor(bytes / MB)} MB`;

const isRetired = (asset: MediaAssetDto) => asset.state === "RETIRED";
const nothingSelected: { kind: "refused"; notice: BulkNotice } = { kind: "refused", notice: notice("error", C.nothingSelected) };
const retiredOnly: { kind: "refused"; notice: BulkNotice } = { kind: "refused", notice: notice("error", C.retiredOnlyDownload) };

/** `selected` is what "Try again" re-sends after an error. Null for a cancel: nothing to say. */
export function zipNotice(outcome: LibraryZipOutcome, selected: string[] = []): BulkNotice | null {
  switch (outcome.kind) {
    case "saved": {
      const leftOut = [
        outcome.links > 0 && C.zipLinks(outcome.links),
        outcome.deleted > 0 && C.zipRemoved(outcome.deleted),
        outcome.gone > 0 && C.zipNotOurs(outcome.gone),
      ];
      const failed = outcome.failedIds.length;
      if (failed === 0) return notice("success", C.zipDone(outcome.saved), lines(...leftOut));
      return {
        ...notice("warning", C.zipPartial(outcome.saved, outcome.total), lines(C.zipPartialFailed(failed), ...leftOut)),
        retry: { label: C.zipRetry(failed), ids: outcome.failedIds },
      };
    }
    case "noneFetched":
      return notice(
        "error",
        C.zipNoneFetched,
        lines(outcome.links > 0 && C.zipLinks(outcome.links), outcome.deleted > 0 && C.zipRemoved(outcome.deleted), outcome.gone > 0 && C.zipNotOurs(outcome.gone)),
      );
    case "nothingToZip":
      return notice(
        "warning",
        C.zipNothing,
        lines(outcome.links > 0 && C.zipNothingHint, outcome.deleted > 0 && C.zipRemoved(outcome.deleted), outcome.gone > 0 && C.zipNotOurs(outcome.gone)),
      );
    case "tooBig":
      return notice(
        "error",
        outcome.totalBytes === null ? C.zipTooBigMidway(limitMb(outcome.limitBytes)) : C.zipTooBig(sizeMb(outcome.totalBytes), limitMb(outcome.limitBytes)),
        C.zipTooBigHint,
      );
    case "error":
      return { ...notice("error", C.unreachable), retry: { label: C.tryAgain, ids: selected } };
    case "cancelled":
      return null;
  }
}

export type RetirePlan =
  | { kind: "refused"; notice: BulkNotice }
  /** `inUse` is the loaded DTOs' estimate (trd D8); the server's outcome replaces it in the toast. */
  | { kind: "confirm"; ids: string[]; inUse: number; alreadyRetired: number };

export function planRetire(picked: MediaAssetDto[]): RetirePlan {
  if (picked.length === 0) return nothingSelected;
  const live = picked.filter((asset) => !isRetired(asset));
  if (live.length === 0) return retiredOnly;
  const ids = live.filter((asset) => asset.uses === 0).map((asset) => asset.id);
  const inUse = live.length - ids.length;
  if (ids.length === 0) return { kind: "refused", notice: notice("error", C.retireAllUsed, C.retireAllUsedHint(inUse)) };
  return { kind: "confirm", ids, inUse, alreadyRetired: picked.length - live.length };
}

/** `alreadyRetired` is the retired items the selection held, which were never sent. */
export function retireNotice(outcome: MediaBulkRetireOutcome, alreadyRetired: number): BulkNotice {
  const already = alreadyRetired + outcome.alreadyRetired.length;
  const description = lines(
    outcome.inUse.length > 0 && C.retireTurnedUsed(outcome.inUse.length),
    already > 0 && C.alreadyRetired(already),
    outcome.notFound.length > 0 && C.zipNotOurs(outcome.notFound.length),
  );
  if (outcome.retired.length === 0) return notice("warning", C.retireAllUsed, description);
  return notice("success", C.retireDone(outcome.retired.length), description);
}

export type TagPlan = { kind: "refused"; notice: BulkNotice } | { kind: "open"; ids: string[]; videos: number; retired: number };

export function planTag(picked: MediaAssetDto[]): TagPlan {
  if (picked.length === 0) return nothingSelected;
  const retired = picked.filter(isRetired).length;
  if (retired === picked.length) return retiredOnly;
  const ids = picked.filter((asset) => asset.kind === "IMAGE" && !isRetired(asset)).map((asset) => asset.id);
  if (ids.length === 0) return { kind: "refused", notice: notice("error", C.tagNoPhotos) };
  const videos = picked.filter((asset) => asset.kind !== "IMAGE" && !isRetired(asset)).length;
  return { kind: "open", ids, videos, retired };
}

export function tagNotice(
  outcome: MediaBulkTagOutcome,
  sent: { on: boolean; tag: string; videos: number; retired: number },
): BulkNotice {
  const videos = sent.videos + outcome.notPhoto.length;
  const retired = sent.retired + outcome.retired.length;
  const n = outcome.changed.length;
  return notice(
    "success",
    sent.on ? C.tagAdded(n, sent.tag) : C.tagRemoved(n, sent.tag),
    lines(
      videos > 0 && C.tagVideosLeftOut(videos),
      retired > 0 && C.retiredOnlyDownload,
      outcome.notFound.length > 0 && C.zipNotOurs(outcome.notFound.length),
    ),
  );
}

/**
 * One request per 100 ids (Q10), in order. Stops at the first failure and hands back what had
 * already landed, so the caller can say what changed rather than "nothing was changed".
 */
export async function sendInBatches<T>(
  ids: string[],
  send: (chunk: string[]) => Promise<T>,
): Promise<{ results: T[]; failure: unknown }> {
  const results: T[] = [];
  for (let at = 0; at < ids.length; at += MEDIA_BULK_MAX_IDS) {
    try {
      results.push(await send(ids.slice(at, at + MEDIA_BULK_MAX_IDS)));
    } catch (failure) {
      return { results, failure };
    }
  }
  return { results, failure: null };
}

/** Joins the outcomes of several batches into one, list by list. */
export function mergeOutcomes<T extends { [K in keyof T]: string[] }>(results: T[]): T | null {
  if (results.length === 0) return null;
  return results.reduce((all, next) => {
    const merged = { ...all };
    for (const key of Object.keys(next) as (keyof T)[]) merged[key] = [...all[key], ...next[key]] as T[keyof T];
    return merged;
  });
}
