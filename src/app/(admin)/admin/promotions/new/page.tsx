/** New platform offer. Options are loaded server-side; the form posts to the platform route. */
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { categoryRepository } from "@server/catalog/category.repository";
import { productsRepository } from "@server/catalog/product.repository";
import { OfferForm } from "@/components/promotions/OfferForm";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
export default async function NewPlatformOfferPage() {
  await requirePlatformAdmin();
  const [categories, products] = await Promise.all([
    categoryRepository.listForPicker(),
    productsRepository.listForPicker(),
  ]);

  return (
    <PageShell width="narrow">
      <PageHeader
        title="New offer"
        description="Platform-funded. Where an organisation already offers something on the same item, you pay only the difference."
      />
      <OfferForm
        action="/api/admin/promotions"
        returnTo="/admin/promotions"
        categories={categories}
        products={products.products}
        productTotal={products.total}
        productSearchPath="/api/admin/promotions/products"
      />
    </PageShell>
  );
}
