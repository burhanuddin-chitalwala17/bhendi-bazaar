/** Platform offers. Scope is fixed by the route, not chosen in the page. */
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminPromotionService } from "@server/promotions/admin.promotion.service";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OfferList, type OfferRow } from "@/components/promotions/OfferList";
import { Icon } from "@/components/ui/icon";
import { PageHeader, PageShell } from "@/components/shared/page-shell";

export default async function AdminPromotionsPage() {
  await requirePlatformAdmin();
  const offers = (await adminPromotionService.list({
    scope: "PLATFORM",
  })) as unknown as {
    offers: OfferRow[];
    pagination: { page: number; totalPages: number; total: number };
  };

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
      <OfferList
        offers={offers.offers}
        basePath="/admin/promotions"
        apiPath="/api/admin/promotions"
      />
    </PageShell>
  );
}
