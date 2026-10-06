/** Platform offers. Scope is fixed by the route, not chosen in the page. */
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminPromotionService } from "@server/promotions/admin.promotion.service";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfferList, type OfferRow } from "@/components/promotions/OfferList";
import { SectionHeader } from "@/components/shared/SectionHeader";

export default async function AdminPromotionsPage() {
  await requirePlatformAdmin();
  const offers = (await adminPromotionService.list({
    scope: "PLATFORM",
  })) as unknown as {
    offers: OfferRow[];
    pagination: { page: number; totalPages: number; total: number };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader as="h1" title="Offers" description="Platform-funded offers. These apply across every organisation's goods, and the platform bears whatever an organisation's own offer does not already cover." />
        <Button asChild>
          <Link href="/admin/promotions/new" prefetch={false}>
            <Plus className="size-4" aria-hidden /> New offer
          </Link>
        </Button>
      </div>
      <OfferList
        offers={offers.offers}
        basePath="/admin/promotions"
        apiPath="/api/admin/promotions"
      />
    </div>
  );
}
