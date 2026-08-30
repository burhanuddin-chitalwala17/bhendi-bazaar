import type { Category } from "@/domain/category";

interface CategoryHeroProps {
  category: Category;
}

export function CategoryHero({ category }: CategoryHeroProps) {
  return (
    // On a phone this is a page header, not a landing scene — the products it
    // introduces have to be on screen with it (ADR-0016).
    <section className="mb-4 overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-hero via-hero/90 to-scrim px-4 py-5 text-hero-foreground sm:mb-6 sm:rounded-2xl sm:px-10 sm:py-14">
      <p className="text-4xs font-semibold uppercase tracking-eyebrow-wide text-hero-foreground/70 sm:text-2xs sm:tracking-display">
        Bhendi Bazaar · {category.name}
      </p>
      <h1 className="mt-1 font-heading text-xl font-semibold leading-tight tracking-tight sm:mt-2 sm:text-4xl">
        {category.name}
      </h1>
      <p className="mt-1.5 line-clamp-2 max-w-xl text-xs leading-snug text-hero-foreground/85 sm:mt-3 sm:line-clamp-none sm:text-sm sm:leading-normal">
        {category.description}
      </p>
    </section>
  );
}
