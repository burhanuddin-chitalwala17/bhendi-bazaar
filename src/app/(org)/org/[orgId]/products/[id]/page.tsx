import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProductsView } from "@/admin/products/ProductsView";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";

export default async function OrgProductViewPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>;
}) {
  const { orgId, id } = await params;
  const product = await adminProductsDAL.getProductById(id);

  // A product id in the path is the caller's to choose. Not-found rather than forbidden:
  // whether another org owns this id is not this caller's business.
  if (!product || product.org.id !== orgId) notFound();

  return (
    <Suspense>
      <ProductsView product={product} category={product.category} org={product.org} />
    </Suspense>
  );
}
