import { cache } from "react";
import {
  fulfilmentSettingsService,
  type CancelCountRow,
  type FulfilmentSettingsView,
} from "@server/payouts/fulfilment-settings.service";

/** The fee setting and the cancellation count, read on the server (order-fulfilment ux.md "admin fee setting"). */
class FulfilmentSettingsDAL {
  view = cache(async (): Promise<FulfilmentSettingsView> => await fulfilmentSettingsService.view());

  /** The first `pages` pages of the count table ("Load more" grows it). */
  counts = cache(async (pages: number): Promise<{ rows: CancelCountRow[]; total: number }> => {
    const all: CancelCountRow[] = [];
    let total = 0;
    for (let page = 1; page <= pages; page++) {
      const next = await fulfilmentSettingsService.cancelCounts(page);
      all.push(...next.rows);
      total = next.total;
      if (all.length >= total) break;
    }
    return { rows: all, total };
  });
}

export const fulfilmentSettingsDAL = new FulfilmentSettingsDAL();
