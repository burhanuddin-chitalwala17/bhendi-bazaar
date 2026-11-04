/** Edit an organisation's own offer — scoped by membership, never by the URL alone. */
import { notFound } from "next/navigation";
import { requireOrgMember } from "@/lib/org-auth";
import { adminPromotionService } from "@server/promotions/admin.promotion.service";
import { categoryRepository } from "@server/catalog/category.read.repository";
import { productsRepository } from "@server/catalog/product.read.repository";
import { orgRepository } from "@server/catalog/org.repository";
import { OfferForm } from "@/components/promotions/OfferForm";
import { toInitialValues } from "@/components/promotions/toInitialValues";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { ORG_PAGES_COPY } from "@/components/org/pages-copy";
import { ROUTES } from "@server/shared/routes";
export default async function EditOrgOfferPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>;
}) {
  const { orgId, id } = await params;
  const scope = await requireOrgMember(orgId);

  const [offer, categories, products, org] = await Promise.all([
    adminPromotionService.findForEdit(id, { scope: "ORG", orgId: scope.orgId }),
    categoryRepository.listForPicker(),
    productsRepository.listForPicker({ orgId: scope.orgId }),
    orgRepository.findCommercialTerms(scope.orgId),
  ]);
  if (!offer) notFound();

  // Products this offer already names, whichever page they would fall on.
  const selectedProducts = await productsRepository.listByIds(
    offer.targets.flatMap((target) =>
      target.productId ? [target.productId] : [],
    ),
  );

  return (
    <PageShell width="narrow">
      <PageHeader
        help="promotions"
        title={ORG_PAGES_COPY.editOffer}
        description={ORG_PAGES_COPY.editOfferDescription}
      />
      <OfferForm
        action={`/api/org/${scope.orgId}/promotions/${id}`}
        method="PATCH"
        initial={toInitialValues(offer)}
        returnTo={ROUTES.org.promotions(scope.orgId)}
        categories={categories}
        products={products.products}
        productTotal={products.total}
        selectedProducts={selectedProducts}
        productSearchPath={`/api/org/${scope.orgId}/promotions/products`}
        codePrefix={org ? `${org.code}-` : undefined}
      />
    </PageShell>
  );
}
