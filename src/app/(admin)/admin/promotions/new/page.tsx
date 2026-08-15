/** New platform offer. Options are loaded server-side; the form posts to the platform route. */
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { categoryRepository } from "@server/catalog/category.repository";
import { productsRepository } from "@server/catalog/product.repository";
import { OfferForm } from "@/components/promotions/OfferForm";

export default async function NewPlatformOfferPage() {
  await requirePlatformAdmin();
  const [categories, products] = await Promise.all([
    categoryRepository.listForPicker(),
    productsRepository.listForPicker(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">New offer</h1>
        <p className="text-sm text-muted-foreground">
          Platform-funded. Where an organisation already offers something on the same item, you
          pay only the difference.
        </p>
      </div>
      <OfferForm
        action="/api/admin/promotions"
        returnTo="/admin/promotions"
        categories={categories}
        products={products.products}
        productTotal={products.total}
        productSearchPath="/api/admin/promotions/products"
      />
    </div>
  );
}
