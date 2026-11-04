/** Edit a platform offer. The scope filter in the lookup is the permission check. */
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminPromotionService } from "@server/promotions/admin.promotion.service";
import { categoryRepository } from "@server/catalog/category.read.repository";
import { productsRepository } from "@server/catalog/product.read.repository";
import { commercialTermsService } from "@server/catalog/commercial-terms.service";
import { OfferForm } from "@/components/promotions/OfferForm";
import { toInitialValues } from "@/components/promotions/toInitialValues";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { ADMIN_OFFERS_PAGE_COPY } from "@/components/promotions/promotions-copy";
import { ROUTES } from "@server/shared/routes";
export default async function EditPlatformOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const [offer, categories, products, lowestRateBps] = await Promise.all([
    adminPromotionService.findForEdit(id, { scope: "PLATFORM" }),
    categoryRepository.listForPicker(),
    productsRepository.listForPicker(),
    commercialTermsService.lowestCommissionBps(),
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
        title={ADMIN_OFFERS_PAGE_COPY.editTitle}
        description={ADMIN_OFFERS_PAGE_COPY.editDescription}
      />
      <OfferForm
        action={`/api/admin/promotions/${id}`}
        method="PATCH"
        initial={toInitialValues(offer)}
        returnTo={ROUTES.admin.promotions}
        categories={categories}
        products={products.products}
        productTotal={products.total}
        selectedProducts={selectedProducts}
        productSearchPath="/api/admin/promotions/products"
        lossRule={{ lowestRateBps }}
      />
    </PageShell>
  );
}
