/** An organisation's own offers — scoped by membership, never by a query parameter. */
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/shared/page-shell";
import { OffersBrowser } from "@/components/promotions/offers-browser";
import { requireOrgMember } from "@/lib/org-auth";
import { offerListQuerySchema } from "@/lib/validation/schemas/promotion.schema";
import { adminPromotionService } from "@server/promotions/admin.promotion.service";
import { ORG_PAGES_COPY } from "@/components/org/pages-copy";
import { ROUTES } from "@server/shared/routes";

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
  const basePath = ROUTES.org.promotions(scope.orgId);

  return (
    <div className="space-y-5">
      <PageHeader
        help="promotions"
        title={ORG_PAGES_COPY.offersTitle}
        description={ORG_PAGES_COPY.offersDescription}
        actions={
          <Button asChild>
            <Link href={ROUTES.org.newPromotion(scope.orgId)} prefetch={false}>
              <Icon name="add" size="sm" /> {ORG_PAGES_COPY.newOffer}
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
