import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Category } from "@/domain/category";
import { SectionHeader } from "@/components/shared/SectionHeader";
export async function CategorySections({ categories }: { categories: Category[] }) {

  return (
    <section className="space-y-4">
      <SectionHeader overline="Categories" title="Browse by lane" />
      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((category) => (
          <Link key={category.slug} href={`/category/${category.slug}`}>
            <Card className="relative overflow-hidden border-border/70 bg-card/80 p-5 transition hover:-translate-y-1 hover:border-primary/70 hover:shadow-md">
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${category.accentColorClass}`}
              />
              <div className="relative space-y-1 text-hero-foreground">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-hero-foreground/70">
                  Category
                </p>
                <h3 className="font-heading text-lg font-semibold tracking-tight">
                  {category.name}
                </h3>
                <p className="text-xs text-hero-foreground/85">
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
