/**
 * Shapes shared by the bulk-upload validate and create steps
 * (bulk-catalog-upload; DTOs mirrored in docs/CONTRACTS.md).
 */

/** One problem, attributed to where the user can fix it (R3). */
export interface RowError {
  /** Excel row number; 0 for sheet-level problems (bad headers, over the cap). */
  row: number;
  field: string;
  message: string;
}

/** A product row after Zod — typed, but not yet checked against the database. */
export interface BulkProductRow {
  name: string;
  description: string;
  /** Rupees as the sheet said; converted to paise once, at create (Invariant 3). */
  price: number;
  categorySlug: string;
  sku?: string;
  weight: number;
  sizes: string[];
  colors: string[];
  tags: string[];
  /** Image filenames, gallery order; the first is the default cover (R12). */
  images: string[];
  /** Cover filename; must be one of `images`. */
  cover?: string;
  /** YouTube video id, already parsed from whatever URL the sheet carried (R11). */
  videoRef?: string;
  /** location name -> quantity, matched to the org's pickup locations (R5). */
  stock: Record<string, number>;
}

/** A row at create time: same row, plus where its images now live. */
export interface BulkProductCreateRow extends BulkProductRow {
  /** filename -> Blob URL, uploaded by the browser after validation passed. */
  imageUrls: Record<string, string>;
}

export interface BulkValidationSummary {
  rows: number;
  images: number;
  locations: string[];
}

export const BULK_MAX_ROWS = 300;
