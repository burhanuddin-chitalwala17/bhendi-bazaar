/** Platform offers. Scope is fixed by the route, not chosen in the page. */
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { OffersBrowser } from "@/components/promotions/offers-browser";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { offerListQuerySchema } from "@/lib/validation/schemas/promotion.schema";
import { adminPromotionService } from "@server/promotions/admin.promotion.service";

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
        title="Offers"
        description="Platform-funded offers. They apply across every shop's goods, and the platform bears whatever a shop's own offer does not already cover."
        actions={
          <Button asChild>
            <Link href="/admin/promotions/new" prefetch={false}>
              <Icon name="add" /> New offer
            </Link>
          </Button>
        }
      />
      <OffersBrowser
        result={result}
        query={query}
        now={now}
        basePath="/admin/promotions"
        apiPath="/api/admin/promotions"
        newHref="/admin/promotions/new"
      />
    </PageShell>
  );
}
