import type { Product } from "@/domain/product";
import { ProductGrid } from "@/components/shared/product-grid";
import { SectionHeader } from "../shared/SectionHeader";

interface SimilarProductsProps {
  products: Product[];
}

export function SimilarProducts({ products }: SimilarProductsProps) {
  if (!products.length) return null;

  return (
    <section className="space-y-4">
      <SectionHeader title="You may also like" description="Pieces from nearby lanes" />
      <ProductGrid products={products} />
    </section>
  );
}
