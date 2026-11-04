/** New platform offer. Options are loaded server-side; the form posts to the platform route. */
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { categoryRepository } from "@server/catalog/category.read.repository";
import { productsRepository } from "@server/catalog/product.read.repository";
import { commercialTermsService } from "@server/catalog/commercial-terms.service";
import { OfferForm } from "@/components/promotions/OfferForm";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { ADMIN_OFFERS_PAGE_COPY } from "@/components/promotions/promotions-copy";
import { ROUTES } from "@server/shared/routes";
export default async function NewPlatformOfferPage() {
  await requirePlatformAdmin();
  const [categories, products, lowestRateBps] = await Promise.all([
    categoryRepository.listForPicker(),
    productsRepository.listForPicker(),
    commercialTermsService.lowestCommissionBps(),
  ]);

  return (
    <PageShell width="narrow">
      <PageHeader
        title={ADMIN_OFFERS_PAGE_COPY.newTitle}
        description={ADMIN_OFFERS_PAGE_COPY.newDescription}
      />
      <OfferForm
        action="/api/admin/promotions"
        returnTo={ROUTES.admin.promotions}
        categories={categories}
        products={products.products}
        productTotal={products.total}
        productSearchPath="/api/admin/promotions/products"
        lossRule={{ lowestRateBps }}
      />
    </PageShell>
  );
}
