import type { Product } from "@/domain/product";
import { ProductGrid } from "@/components/shared/product-grid";
import { SectionHeader } from "../shared/SectionHeader";
import { PRODUCT_PAGE_COPY } from "./product-copy";

interface SimilarProductsProps {
  products: Product[];
  shopHandle?: string | null;
}

export function SimilarProducts({ products, shopHandle = null }: SimilarProductsProps) {
  if (!products.length) return null;

  return (
    <section className="space-y-4">
      <SectionHeader title={PRODUCT_PAGE_COPY.similar.title} description={PRODUCT_PAGE_COPY.similar.description} />
      <ProductGrid products={products} shopHandle={shopHandle} />
    </section>
  );
}
