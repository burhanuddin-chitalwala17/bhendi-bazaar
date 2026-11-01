import { ledgerService } from "@server/payouts/ledger.service";
import { fulfilmentSettingsService } from "@server/payouts/fulfilment-settings.service";

/**
 * What cancelling costs a shop (order-fulfilment D14, ux.md "Shop cancel sheet"): the fee a cancel
 * would charge now, and what each of these parcels' cancels was charged, paise.
 */
export async function shopCancelFees(shipmentIds: string[]): Promise<{ feePaise: number; charged: Record<string, number> }> {
  const [{ feePaise }, charged] = await Promise.all([fulfilmentSettingsService.view(), ledgerService.cancellationFeesFor(shipmentIds)]);
  return { feePaise, charged };
}
