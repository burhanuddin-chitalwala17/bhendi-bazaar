import { cache } from "react";
import { bulkSheetService, type SheetChoicesDTO } from "@server/catalog/bulk/bulk-sheet.service";

/** What the Get the sheet step offers to tick (own-store/bulk-sheet R1, Q2). */
export const getBulkSheetChoices = cache(
  (orgId: string): Promise<SheetChoicesDTO> => bulkSheetService.choices(orgId),
);
