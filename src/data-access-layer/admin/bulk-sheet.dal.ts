import { cache } from "react";
import { bulkSheetService, type SheetChoicesDTO } from "@server/catalog/bulk/bulk-sheet.service";

/** What the team's Get the sheet step offers to tick for a shop (own-store/bulk-sheet R9, D11). */
export const getTeamBulkSheetChoices = cache(
  (orgId: string): Promise<SheetChoicesDTO> => bulkSheetService.choices(orgId),
);
