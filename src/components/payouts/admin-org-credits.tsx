import { creditService } from "@server/payouts/credit.service";
import { AdminCreditsPanel } from "./admin-credits-panel";

/** The admin shop console's Credits tab (ai-images/shop-credits ux.md journeys 6–7). */
export async function AdminOrgCredits({ orgId, shop }: { orgId: string; shop: string }) {
  const account = await creditService.adminAccount(orgId);
  return <AdminCreditsPanel orgId={orgId} shop={shop} initial={account} />;
}
