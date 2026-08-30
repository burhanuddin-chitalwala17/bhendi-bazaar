/**
 * New organisation offer.
 *
 * Products are scoped to this organisation — an offer can only cover its own goods,
 * and offering a picker of someone else's would be an error waiting to be made rather
 * than a rule to enforce afterwards.
 */
import { requireOrgMember } from "@/lib/org-auth";
import { categoryRepository } from "@server/catalog/category.repository";
import { productsRepository } from "@server/catalog/product.repository";
import { orgRepository } from "@server/catalog/org.repository";
import { OfferForm } from "@/components/promotions/OfferForm";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
export default async function NewOrgOfferPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);

  const [categories, products, org] = await Promise.all([
    categoryRepository.listForPicker(),
    productsRepository.listForPicker({ orgId: scope.orgId }),
    orgRepository.findCommercialTerms(scope.orgId),
  ]);

  return (
    <PageShell width="narrow">
      <PageHeader
        title="New offer"
        description={`You bear what this costs, up to ${(org?.maxDiscountBps ?? 5000) / 100}%. If the platform runs something deeper on the same item, it pays the difference.`}
      />
      <OfferForm
        action={`/api/org/${scope.orgId}/promotions`}
        returnTo={`/org/${scope.orgId}/promotions`}
        categories={categories}
        products={products.products}
        productTotal={products.total}
        productSearchPath={`/api/org/${scope.orgId}/promotions/products`}
        codePrefix={org ? `${org.code}-` : undefined}
      />
    </PageShell>
  );
}
