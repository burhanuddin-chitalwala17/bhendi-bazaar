/**
 * The sheet-age copy both ends say (own-store/bulk-sheet ux.md, Upload): the server's refusal and
 * the screen's banners. No node imports, so the browser can read it.
 */
export const SHEET_AGE_COPY = {
  stale: (date: string | null) =>
    date
      ? `This sheet is from ${date}. Our lists changed since — new rows may miss new choices.`
      : "This sheet has no date. Our lists may have changed since — new rows may miss new choices.",
  tooOld: (column: string) => `This sheet is too old to read: the '${column}' column has changed.`,
  continue: "Continue with this sheet",
  fresh: "Download a fresh sheet",
} as const;

/** "bulk sheet.xlsx" → "bulk-sheet-problems-marked.xlsx" (D7): ASCII only, so the header needs no encoding. */
export function markedFileName(uploaded: string): string {
  const base = uploaded.replace(/\.(xlsx|csv)$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base || "sheet"}-problems-marked.xlsx`;
}

/** What the check found about the file itself, beside its rows (TRD D4, D8). */
export interface SheetAge {
  /** ISO: the stamp's made-on date, or an unstamped .xlsx's own creation date (Q28); null when neither says. */
  madeOn: string | null;
  /** The stamp's shown version, the fingerprint's first six characters (Q27). */
  version: string | null;
  /** Older than today's sheet but every column still reads: warned, accepted (own-store Q10). */
  stale: boolean;
  /** The heading of the first column that no longer reads: refused. */
  refusedColumn: string | null;
}
