import { PortalPageSkeleton } from "@/components/org/portal-page-skeleton";
import { ORG_LOADING_COPY } from "@/components/org/pages-copy";

export default function BiddingLoading() {
  return <PortalPageSkeleton label={ORG_LOADING_COPY.auctions} />;
}
