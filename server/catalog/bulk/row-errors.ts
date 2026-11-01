/**
 * Each problem named by the heading the shop's own file shows (own-store/bulk-sheet D8), so the
 * screen can group and filter by column in the shop's words, renamed headings included.
 */
import type { RowError } from "./bulk.types";
import type { RawSheet } from "./sheet";
import { tabColumns } from "./sheet-columns";

/** A row field whose column key differs from the field's own name. */
const COLUMN_OF_FIELD: Record<string, string> = {
  categoryslug: "category",
  familyname: "family",
  brandname: "brand",
  videoref: "video",
  // The type is read from the category, so a type problem is the category cell's.
  producttype: "category",
};

const STOCK_PREFIX = "stock:";

/** The column key a problem's field sits in — what both the screen and the returned file name it by. */
export const columnKeyOf = (field: string): string => COLUMN_OF_FIELD[field.toLowerCase()] ?? field.toLowerCase();

/** A sheet without key rows (a .csv, an old .xlsx) is named in the words today's sheet uses. */
const STANDARD_HEADINGS = new Map(
  tabColumns(null, [], { brands: true }).map((column) => [column.key.toLowerCase(), column.heading]),
);

export function nameColumns(errors: readonly RowError[], raw: Pick<RawSheet, "tabs">): RowError[] {
  const headings = new Map(
    (raw.tabs ?? []).map((tab) => [tab.name, new Map(tab.columns.map((column) => [column.key, column.heading]))]),
  );
  return errors.map((error) => {
    if (error.row === 0) return error;
    const key = columnKeyOf(error.field);
    const column =
      (error.tab ? headings.get(error.tab)?.get(key) : undefined) ||
      STANDARD_HEADINGS.get(key) ||
      (key.startsWith(STOCK_PREFIX) ? `Stock at ${error.field.slice(STOCK_PREFIX.length)}` : error.field);
    return { ...error, column };
  });
}
