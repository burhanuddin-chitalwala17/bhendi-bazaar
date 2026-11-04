/** An organisation's own offers — scoped by membership, never by a query parameter. */
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/shared/page-shell";
import { OffersBrowser } from "@/components/promotions/offers-browser";
import { requireOrgMember } from "@/lib/org-auth";
import { offerListQuerySchema } from "@/lib/validation/schemas/promotion.schema";
import { adminPromotionService } from "@server/promotions/admin.promotion.service";

export default async function OrgPromotionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);
  const query = offerListQuerySchema.parse(await searchParams);
  const now = new Date();
  const result = await adminPromotionService.listOffers({ scope: "ORG", orgId: scope.orgId }, query, now);
  const basePath = `/org/${scope.orgId}/promotions`;

  return (
    <div className="space-y-5">
      <PageHeader
        help="promotions"
        title="Offers"
        description="Your own offers, on your own goods. You bear what they cost — and if the platform runs something deeper, it pays the difference rather than you."
        actions={
          <Button asChild>
            <Link href={`${basePath}/new`} prefetch={false}>
              <Icon name="add" size="sm" /> New offer
            </Link>
          </Button>
        }
      />
      <OffersBrowser
        result={result}
        query={query}
        now={now}
        basePath={basePath}
        apiPath={`/api/org/${scope.orgId}/promotions`}
        newHref={`${basePath}/new`}
      />
    </div>
  );
}
