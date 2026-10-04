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
  tags: string[];
  /**
   * The listing vocabulary, as the sheet said it
   * ([listing-vocabulary](../../../docs/specs/listing-vocabulary/)).
   *
   * `productType` is accepted here, unlike on the product form, because a sheet row names its
   * own type — that is what lets one workbook span several (Amazon's shape). It is still
   * checked against the category, so a row cannot put a product under a type its category
   * does not use.
   *
   * The answers are the **labels** the dropdowns offered, not the keys we store: resolving one
   * to the other needs the database, so it happens in the service with the other semantic
   * checks rather than here.
   */
  productType?: string;
  kind?: string;
  /** A family by name; one that does not exist yet is created once and reused by later rows. */
  familyName?: string;
  salePrice?: number;
  factLabels: Record<string, string>;
  measurements: Record<string, number>;
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
