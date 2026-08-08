// app/(admin)/admin/products/[id]/page.tsx

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProductsView } from "@/admin/products/ProductsView";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";

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
    <Suspense fallback={<div>Loading...</div>}>
      <ProductsView product={product} category={product.category} org={product.org} canEdit={false} />
    </Suspense>
  );
}