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
import { ADMIN_BIDDING_COPY } from "./bidding-copy";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminBiddingPage() {
  await requirePlatformAdmin();
  const events = await adminBiddingService.list();
  const awaiting = events.filter((event) => event.phase === "ENDED");

  return (
    <PageShell width="wide">
      <PageHeader
        title={ADMIN_BIDDING_COPY.title}
        description={ADMIN_BIDDING_COPY.description(awaiting.length)}
      />

      <AdminBiddingList events={events} />
    </PageShell>
  );
}
