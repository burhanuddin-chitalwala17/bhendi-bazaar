import Link from "next/link";

import { Button } from "@/components/ui/button";

export function HomeHero() {
  return (
    // A phone shows one screenful at a time; a full-height brand hero spends it on
    // something nobody came to buy. Compact banner on mobile, the full scene from sm.
    <section className="relative overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-hero via-hero/90 to-scrim px-4 py-6 text-hero-foreground sm:rounded-2xl sm:px-10 sm:py-16">
      <div className="pointer-events-none absolute -left-10 -top-20 h-64 w-64 rounded-full border border-primary/15" />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_top,rgba(250,250,249,0.12),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,24,40,0.35),transparent_70%)]" />

      <div className="relative max-w-xl space-y-2 sm:space-y-4">
        <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.25em] text-hero-foreground/70 sm:text-[0.7rem] sm:tracking-[0.35em]">
          Bhendi Bazaar · Islamic Boutique
        </p>
        <h1 className="font-heading text-xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Royal silhouettes, old-city soul.
        </h1>
        <p className="text-xs leading-snug text-hero-foreground/80 sm:text-base sm:leading-normal">
          From emerald abayas to filigree accents, discover pieces inspired by
          the lanes, minarets, and balconies of Bhendi Bazaar.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          {/* coming soon tag */}
          {/* <Button
            asChild
            className="rounded-full bg-primary px-6 text-xs font-semibold uppercase tracking-[0.2em] text-hero hover:bg-primary/80"
          >
            <Link href="/category/abayas">Shop Abayas</Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="rounded-full border-primary/20 bg-transparent text-xs font-semibold uppercase tracking-[0.2em] text-hero-foreground hover:bg-hero/40"
          >
            <Link href="/category/attars">Browse Attars</Link>
          </Button> */}
        </div>
      </div>
    </section>
  );
}


