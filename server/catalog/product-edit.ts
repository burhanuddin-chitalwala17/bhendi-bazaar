/**
 * Who changed a product, and when, in the words a refused save uses (product-form D7, Q11, Q35).
 * Pure, so the refusal and its tests read one wording.
 */

/** The team as a shop reads it: never the admin's own name (own-store Q17). */
export const TEAM_EDITOR = "Bhendi Bazaar team";

/** The path a version refusal is attributed to, so the form can tell it from every other 409. */
export const VERSION_FIELD = "seenVersion";

/** The path a stock refusal is attributed to: a sale landed on a row the editor saw (ADR-0007). */
export const STOCK_FIELD = "stock";

export interface LastEdit {
  lastEditedById: string | null;
  lastEditedAt: Date | null;
  /** Set by a team save and cleared by the shop's next one, so set means the team saved last. */
  teamEditedAt: Date | null;
  lastEditedByName: string | null;
}

export function editorWords(edit: LastEdit, viewerId: string): string {
  if (edit.teamEditedAt) return TEAM_EDITOR;
  if (edit.lastEditedById && edit.lastEditedById === viewerId) return "You";
  return edit.lastEditedByName?.trim() || "Someone";
}

/** "just now", "2 min ago", "3 hr ago", then a day: "on 30 Oct". */
export function sinceWords(at: Date, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `on ${at.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}`;
}

/** ux.md copy deck, Conflict. */
export function versionConflictMessage(edit: LastEdit, viewerId: string, now = new Date()): string {
  const when = edit.lastEditedAt ? ` ${sinceWords(edit.lastEditedAt, now)}` : "";
  return `${editorWords(edit, viewerId)} changed this product${when}. We loaded the latest and kept your changes — check and save.`;
}
