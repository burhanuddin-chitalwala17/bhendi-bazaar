import { apiDownload, apiRequest } from "@/lib/api-client";
import type { BulkProductRow, RowError } from "@server/catalog/bulk/bulk.types";
import type { BulkCategoryRow } from "@server/catalog/bulk/bulk-category.service";
import type { SheetAge } from "@server/catalog/bulk/sheet-copy";

interface BulkReport<TRow> {
  ok: boolean;
  errors: RowError[];
  rows: { rowNumber: number; tab?: string; row: TRow }[];
}

export interface ProductBulkReport extends BulkReport<BulkProductRow> {
  orgCode: string | null;
  summary: { rows: number; images: number };
  /** How many rows make a product and how many replace one by SKU (R8). */
  plan: { creates: number; updates: number };
  sheet: SheetAge;
}

export interface CategoryBulkReport extends BulkReport<BulkCategoryRow> {
  summary: { rows: number };
}

/** The sheet and the names of the files picked beside it — what the dry run checks against. */
function sheetForm(sheet: File, filenames: string[]): FormData {
  const form = new FormData();
  form.append("sheet", sheet);
  form.append("filenames", JSON.stringify(filenames));
  return form;
}

/** Where a shop's bulk routes live: the shop's own, or the team's for that shop (own-store/bulk-sheet D11). */
export function productBulkBase(orgId: string, team: boolean): string {
  return team ? `/api/admin/orgs/${orgId}/products/bulk` : `/api/org/${orgId}/products/bulk`;
}

type CreateRows = (BulkProductRow & { imageUrls: Record<string, string>; rowNumber: number; tab?: string })[];

/** Bulk import's two requests per kind: a dry run that creates nothing, then the all-or-nothing create. */
export const bulkImportApiClient = {
  /** The workbook for the ticked categories (own-store/bulk-sheet D1). */
  downloadProductSheet(base: string, categoryIds: string[]) {
    const query = new URLSearchParams({ categories: categoryIds.join(",") });
    return apiDownload(`${base}/sample?${query}`);
  },

  validateProducts(base: string, sheet: File, filenames: string[]) {
    return apiRequest<ProductBulkReport>(`${base}/validate`, {
      method: "POST",
      body: sheetForm(sheet, filenames),
    });
  },

  /** The shop's own file back with its problems marked; checked again on the server, never sent as errors (D7). */
  downloadMarkedProducts(base: string, sheet: File, filenames: string[]) {
    return apiDownload(`${base}/marker`, { method: "POST", body: sheetForm(sheet, filenames) });
  },

  /** `team` is the team's reason and the file's name, required on the team's create (D11). */
  createProducts(base: string, rows: CreateRows, team?: { reason: string; fileName: string }) {
    return apiRequest<{ created: number; updated: number }>(base, { method: "POST", body: { rows, ...team } });
  },

  validateCategories(sheet: File, filenames: string[]) {
    return apiRequest<CategoryBulkReport>("/api/admin/categories/bulk/validate", {
      method: "POST",
      body: sheetForm(sheet, filenames),
    });
  },

  createCategories(rows: (BulkCategoryRow & { imageUrl: string })[]) {
    return apiRequest<{ created: number }>("/api/admin/categories/bulk", { method: "POST", body: { rows } });
  },
};
