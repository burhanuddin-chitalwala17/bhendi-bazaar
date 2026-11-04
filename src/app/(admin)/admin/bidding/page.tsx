/**
 * Every bidding event on the platform, newest first.
 *
 * The platform's queue: what has closed and still needs an outcome, and what is
 * running. Only this side ever sees a bidder, so it sits behind the platform-admin
 * guard rather than merely being unlinked from the org console.
 */
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminBiddingService } from "@server/bidding/admin.bidding.service";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { AdminBiddingList } from "@/components/bidding/admin-bidding-list";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminBiddingPage() {
  await requirePlatformAdmin();
  const events = await adminBiddingService.list();
  const awaiting = events.filter((event) => event.phase === "ENDED");

  return (
    <PageShell width="wide">
      <PageHeader
        title="Auctions"
        description={
          awaiting.length > 0
            ? `${awaiting.length} closed ${awaiting.length === 1 ? "auction needs" : "auctions need"} an outcome. Until one is recorded, the item stays off sale.`
            : "Every auction across the platform."
        }
      />

      <AdminBiddingList events={events} />
    </PageShell>
  );
}
