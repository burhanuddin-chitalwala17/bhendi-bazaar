import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Category } from "@/domain/category";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { CATEGORY_ACCENTS } from "@/lib/category-accent";

export async function CategorySections({ categories }: { categories: Category[] }) {
  return (
    <section className="space-y-3 sm:space-y-4">
      <SectionHeader overline="Categories" title="Browse by lane" />
      {/* 2-up on a phone (ADR-0016): lanes are a chooser, and a chooser you have to
          scroll through one option at a time isn't one. */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {categories.map((category) => (
          <Link key={category.slug} href={`/category/${category.slug}`} className="block">
            <Card className="relative h-full overflow-hidden rounded-lg border-border/70 bg-card/80 p-3 transition sm:rounded-xl sm:p-5 md:hover:-translate-y-1 md:hover:border-primary/70 md:hover:shadow-md">
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${CATEGORY_ACCENTS[category.accent].heroGradient}`}
              />
              <div className="relative space-y-1 text-hero-foreground">
                <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.24em] text-hero-foreground/70 sm:text-[0.65rem] sm:tracking-[0.32em]">
                  Category
                </p>
                <h3 className="font-heading text-sm font-semibold leading-tight tracking-tight sm:text-lg">
                  {category.name}
                </h3>
                <p className="line-clamp-2 text-[0.625rem] leading-snug text-hero-foreground/85 sm:text-xs sm:leading-normal">
                  {category.description}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
