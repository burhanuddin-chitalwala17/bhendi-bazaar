import { SectionHeader } from "@/components/shared/SectionHeader";
import type { PillarsSlice } from "./sections";

/**
 * Up to three blocks on how or why this shop works as it does (brand-page R1).
 *
 * One column on a phone, which is the whole layout below `sm`; the grid only ever adds
 * ([ADR-0015](../../../../docs/adr/0015-mobile-first-design.md)). Both halves of a block
 * are required at the schema, so nothing here renders a heading over nothing.
 */
export function BrandPillars({ pillars }: PillarsSlice) {
  return (
    <section className="space-y-3">
      <SectionHeader overline="The shop" title="How we work" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pillars.map((pillar) => (
          <li
            key={pillar.title}
            className="rounded-card border border-border/60 bg-muted/30 p-4"
          >
            <h3 className="text-sm font-semibold text-foreground">{pillar.title}</h3>
            <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
              {pillar.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
