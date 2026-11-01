/** The Check and create step's words (own-store/bulk-sheet ux.md, copy deck). */
import type { RowError } from "@server/catalog/bulk/bulk.types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const CHECK_COPY = {
  clean: (rows: number, creates: number, updates: number) =>
    `All ${rows} rows look good · ${creates} new, ${plural(updates, "update")}`,
  /** Only the halves that do something, so a sheet of new products reads "Create 40". */
  createAction: (creates: number, updates: number) =>
    [creates > 0 ? `Create ${creates}` : "", updates > 0 ? `${creates > 0 ? "update" : "Update"} ${updates}` : ""]
      .filter(Boolean)
      .join(" · ") || "Create",
  problems: (problems: number, rows: number) =>
    `${plural(problems, "problem")}${rows > 0 ? ` in ${plural(rows, "row")}` : ""} · nothing created yet`,
  pickAnother: "Pick another file",
  downloadMarked: "Download your sheet with problems marked",
  fixAndReupload: "Fix the red cells and upload the same file again.",
  marking: "Marking your sheet…",
  markFailed: "Couldn't mark your sheet. Try again.",
  showAll: (problems: number) => `Show all ${problems} problems`,
  allColumns: "All columns",
  done: (total: number, created: number, updated: number) =>
    `${total} products on sale · ${created} new, ${updated} updated`,
  reading: "Reading your sheet…",
} as const;

/** The first problems shown before "Show all" (TRD D8). */
export const PROBLEMS_SHOWN = 20;

export interface ProblemGroup {
  /** "Row 7", "Row 7 · Abaya" when the sheet has tabs, or "Sheet" for problems with the file itself. */
  label: string;
  problems: RowError[];
}

/** Problems grouped by the row they sit on, in the order they came (R7). */
export function groupByRow(errors: readonly RowError[]): ProblemGroup[] {
  const groups = new Map<string, ProblemGroup>();
  for (const error of errors) {
    const label = error.row === 0 ? "Sheet" : `Row ${error.row}${error.tab ? ` · ${error.tab}` : ""}`;
    const group = groups.get(label) ?? { label, problems: [] };
    group.problems.push(error);
    groups.set(label, group);
  }
  return [...groups.values()];
}

/** How many sheet rows have a problem: the file's own problems (row 0) sit on no row. */
export const rowsWithProblems = (errors: readonly RowError[]) =>
  groupByRow(errors.filter((error) => error.row !== 0)).length;
