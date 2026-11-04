/** Platform offers. Scope is fixed by the route, not chosen in the page. */
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { OffersBrowser } from "@/components/promotions/offers-browser";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { offerListQuerySchema } from "@/lib/validation/schemas/promotion.schema";
import { adminPromotionService } from "@server/promotions/admin.promotion.service";
import { ADMIN_OFFERS_PAGE_COPY } from "@/components/promotions/promotions-copy";
import { ROUTES } from "@server/shared/routes";

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin();
  const query = offerListQuerySchema.parse(await searchParams);
  const now = new Date();
  const result = await adminPromotionService.listOffers({ scope: "PLATFORM" }, query, now);

  return (
    <PageShell width="wide">
      <PageHeader
        title={ADMIN_OFFERS_PAGE_COPY.title}
        description={ADMIN_OFFERS_PAGE_COPY.description}
        actions={
          <Button asChild>
            <Link href={ROUTES.admin.newPromotion} prefetch={false}>
              <Icon name="add" /> {ADMIN_OFFERS_PAGE_COPY.newOffer}
            </Link>
          </Button>
        }
      />
      <OffersBrowser
        result={result}
        query={query}
        now={now}
        basePath={ROUTES.admin.promotions}
        apiPath="/api/admin/promotions"
        newHref={ROUTES.admin.newPromotion}
      />
    </PageShell>
  );
}
