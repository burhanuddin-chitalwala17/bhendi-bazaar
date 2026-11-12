import { STOREFRONT_LOCKED_COPY } from "./subscriptions-copy";
import { TalkToUs } from "./talk-to-us";
import { FEATURE } from "@server/subscriptions/feature-access.types";

/**
 * Above a locked storefront, for the shop's team and the admin only (feature-access ux.md "Member
 * or admin", Q6): what everyone else sees, and the way to ask for Storefront.
 */
export function StorefrontTeamBanner({ shop }: { shop: string }) {
  return (
    <div role="note" className="flex flex-col gap-1 border-b border-border bg-info/10 px-4 py-3 text-small sm:flex-row sm:items-center sm:justify-between">
      <span>{STOREFRONT_LOCKED_COPY.memberBanner}</span>
      <TalkToUs feature={FEATURE.STOREFRONT} shop={shop} variant="link" />
    </div>
  );
}
