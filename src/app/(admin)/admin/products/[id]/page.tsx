import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { notFound } from "next/navigation";
import { ProductsView } from "@/components/product/console/ProductsView";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { ADMIN_PRODUCTS_COPY } from "../products-copy";
import { ROUTES } from "@server/shared/routes";

async function getProduct(id: string) {
  const product = await adminProductsDAL.getProductById(id);

  if (!product) {
    notFound();
  }

  return product;
}

export default async function ProductViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  return (
    <>
      {/* The team fixes a shop's product in the shop's own form, on record (product-form R10, Q12). */}
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        {product.teamEditedAt && (
          <span className="text-small text-muted-foreground">
            {ADMIN_PRODUCTS_COPY.teamEdited(formatDate(product.teamEditedAt, { day: "numeric", month: "short" }))}
          </span>
        )}
        <Button asChild>
          <Link href={ROUTES.admin.editProduct(id)} prefetch={false}>{ADMIN_PRODUCTS_COPY.editForShop}</Link>
        </Button>
      </div>
      <ProductsView
        product={product}
        category={product.category}
        org={product.org}
        canEdit={false}
      />
    </>
  );
}
