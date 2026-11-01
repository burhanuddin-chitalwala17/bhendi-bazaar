/**
 * The version a downloaded sheet carries, and what an upload makes of it
 * ([own-store/bulk-sheet](../../../docs/specs/own-store/bulk-sheet/trd.md) D4; Q10, Q27, Q28).
 *
 * A fingerprint over every tab's column keys and every list's words changes exactly when the
 * sheet would, so no counter is stored anywhere.
 */
import { createHash } from "node:crypto";

import type { SheetAge } from "./sheet-copy";

/** Row 1 of the stamp's column on the hidden Lists tab; no list is named with underscores. */
export const STAMP_KEY = "__stamp";

export interface SheetStamp {
  madeOn: Date;
  fingerprint: string;
  /** The ticks the sheet was made for, so an upload can be compared with today's sheet for the same ticks. */
  categoryIds: string[];
}

/** One tab's columns: the key the upload reads and the heading a person reads. */
export interface StampedTab {
  name: string;
  columns: Array<{ key: string; heading: string; required?: boolean }>;
}

export interface SheetPlan {
  fingerprint: string;
  tabs: StampedTab[];
}

export function sheetFingerprint(tabs: readonly StampedTab[], lists: ReadonlyArray<{ name: string; words: string[] }>): string {
  const body = JSON.stringify({
    tabs: tabs.map((tab) => [tab.name, tab.columns.map((column) => column.key)]),
    lists: lists.map((list) => [list.name, list.words]),
  });
  return createHash("sha256").update(body).digest("hex");
}

export const shortVersion = (fingerprint: string) => fingerprint.slice(0, 6);

export interface UploadedSheet {
  csv: boolean;
  createdOn: Date | null;
  stamp: SheetStamp | null;
  /** The keyed tabs as uploaded, keys lower-cased by the reader. */
  tabs?: StampedTab[];
}

const FRESH: SheetAge = { madeOn: null, version: null, stale: false, refusedColumn: null };

/**
 * Same fingerprint, silent; different but every column still reads, stale; a key no longer known
 * or a required column gone, refused naming its heading. Unstamped: a .csv is read as today, an
 * .xlsx is warned with its own date.
 */
export function judgeSheet(upload: UploadedSheet, current: SheetPlan | null): SheetAge {
  if (!upload.stamp) {
    if (upload.csv) return FRESH;
    return { ...FRESH, madeOn: upload.createdOn?.toISOString() ?? null, stale: true };
  }
  const dated = { ...FRESH, madeOn: upload.stamp.madeOn.toISOString(), version: shortVersion(upload.stamp.fingerprint) };
  if (!current || current.fingerprint === upload.stamp.fingerprint) return dated;
  return { ...dated, stale: true, refusedColumn: firstUnreadable(upload.tabs ?? [], current.tabs) };
}

function firstUnreadable(uploaded: readonly StampedTab[], current: readonly StampedTab[]): string | null {
  const everyKey = new Set(current.flatMap((tab) => tab.columns.map((column) => column.key.toLowerCase())));
  for (const tab of uploaded) {
    const today = current.find((candidate) => candidate.name === tab.name);
    // A tab whose type was renamed is still read, so its columns are checked against every tab's.
    const known = today ? new Set(today.columns.map((column) => column.key.toLowerCase())) : everyKey;
    const unknown = tab.columns.find((column) => !known.has(column.key.toLowerCase()));
    if (unknown) return unknown.heading || unknown.key;
    if (!today) continue;
    const have = new Set(tab.columns.map((column) => column.key.toLowerCase()));
    const missing = today.columns.find((column) => column.required && !have.has(column.key.toLowerCase()));
    if (missing) return missing.heading;
  }
  return null;
}
