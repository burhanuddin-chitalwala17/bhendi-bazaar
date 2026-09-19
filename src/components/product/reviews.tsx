import type { Product } from "@/domain/product";
import { SectionHeader } from "../shared/SectionHeader";

interface ReviewsProps {
  product: Product;
}

export function Reviews({ product }: ReviewsProps) {
  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card/80 p-4">
      <SectionHeader overline="Bazaar whispers" title="Customer Reviews" />

      <p className="text-xs text-muted-foreground">
        Detailed customer reviews will appear here once we connect the backend.
        For now, ratings hint at how well this piece is loved.
      </p>
    </section>
  );
}
