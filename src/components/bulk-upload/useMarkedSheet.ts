"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { markedFileName } from "@server/catalog/bulk/sheet-copy";
import { ApiError } from "@/lib/api-error";
import { bulkImportApiClient } from "./bulkImportApiClient";
import { CHECK_COPY } from "./check-copy";
import { saveBlob } from "./files";

/** "Download your sheet with problems marked" (own-store/bulk-sheet R6): the same file, sent again. */
export function useMarkedSheet(orgId: string, sheet: File | null, filenames: string[]) {
  const busy = useRef(false);
  return async () => {
    if (!sheet) return;
    // Never disabled (owner rule): a second tap while marking says so instead.
    if (busy.current) {
      toast(CHECK_COPY.marking);
      return;
    }
    busy.current = true;
    // Marking re-checks the whole sheet, which takes seconds on a phone: answer the tap at once.
    const id = toast.loading(CHECK_COPY.marking);
    try {
      saveBlob(await bulkImportApiClient.downloadMarkedProducts(orgId, sheet, filenames), markedFileName(sheet.name));
      toast.success(CHECK_COPY.fixAndReupload, { id });
    } catch (error) {
      toast.error(markFailure(error), { id });
    } finally {
      busy.current = false;
    }
  };
}

/** A refusal about the file says what to change; only a network or server fault is worth retrying. */
function markFailure(error: unknown): string {
  return error instanceof ApiError && error.status < 500 && error.status !== 429 ? error.message : CHECK_COPY.markFailed;
}
