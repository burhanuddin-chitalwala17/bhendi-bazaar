import { apiRequest } from "@/lib/api-client";
import type { BulkProductRow, RowError } from "@server/catalog/bulk/bulk.types";
import type { BulkCategoryRow } from "@server/catalog/bulk/bulk-category.service";

interface BulkReport<TRow> {
  ok: boolean;
  errors: RowError[];
  rows: { rowNumber: number; row: TRow }[];
}

export interface ProductBulkReport extends BulkReport<BulkProductRow> {
  orgCode: string | null;
  summary: { rows: number; images: number };
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

/** Bulk import's two requests per kind: a dry run that creates nothing, then the all-or-nothing create. */
export const bulkImportApiClient = {
  validateProducts(orgId: string, sheet: File, filenames: string[]) {
    return apiRequest<ProductBulkReport>(`/api/org/${orgId}/products/bulk/validate`, {
      method: "POST",
      body: sheetForm(sheet, filenames),
    });
  },

  createProducts(orgId: string, rows: (BulkProductRow & { imageUrls: Record<string, string> })[]) {
    return apiRequest<{ created: number }>(`/api/org/${orgId}/products/bulk`, { method: "POST", body: { rows } });
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
