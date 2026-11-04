/** An organisation's own offers — scoped by membership, never by a query parameter. */
import { requireOrgMember } from "@/lib/org-auth";
import { Icon } from "@/components/ui/icon";
import { adminPromotionService } from "@server/promotions/admin.promotion.service";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OfferList, type OfferRow } from "@/components/promotions/OfferList";
import { PageHeader } from "@/components/shared/page-shell";

export default async function OrgPromotionsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);
  const offers = (await adminPromotionService.list({
    scope: "ORG",
    orgId: scope.orgId,
  })) as unknown as {
    offers: OfferRow[];
    pagination: { page: number; totalPages: number; total: number };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader help="promotions" title="Offers" description="Your own offers, on your own goods. You bear what they cost — and if the platform runs something deeper, it pays the difference rather than you." />
        <Button asChild>
          <Link href={`/org/${scope.orgId}/promotions/new`} prefetch={false}>
            <Icon name="add" size="sm" /> New offer
          </Link>
        </Button>
      </div>
      <OfferList
        offers={offers.offers}
        basePath={`/org/${scope.orgId}/promotions`}
        apiPath={`/api/org/${scope.orgId}/promotions`}
      />
    </div>
  );
}
