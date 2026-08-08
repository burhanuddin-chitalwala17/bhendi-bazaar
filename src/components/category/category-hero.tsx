import type { Category } from "@/domain/category";

interface CategoryHeroProps {
  category: Category;
}

export function CategoryHero({ category }: CategoryHeroProps) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-hero via-hero/90 to-scrim px-6 py-10 text-hero-foreground sm:px-10 sm:py-14">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-hero-foreground/70">
        Bhendi Bazaar · {category.name}
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
        {category.name}
      </h1>
      <p className="mt-3 max-w-xl text-sm text-hero-foreground/85">
        {category.description}
      </p>
    </section>
  );
}


