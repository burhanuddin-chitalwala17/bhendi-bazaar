import type { BrandProof } from "@server/catalog/storefront.types";

/**
 * Up to three compact stats under the tagline (brand-page R1, R4).
 *
 * The seam part (c) of PR 4 fills: rating and count from published reviews, orders from
 * paid orders, each shown only above its declared floor (D3). Until then every page
 * carries null and this draws nothing — a hero with no proof closes up, never shows a gap.
 */
export function ProofStrip({ proof }: { proof: BrandProof | null }) {
  if (!proof) return null;

  const stats: Array<{ label: string; value: string }> = [];
  if (proof.rating) {
    stats.push({
      label: `${proof.rating.count} reviews`,
      value: proof.rating.average.toFixed(1),
    });
  }
  if (proof.ordersFulfilled != null) {
    stats.push({ label: "orders fulfilled", value: String(proof.ordersFulfilled) });
  }
  if (!stats.length) return null;

  return (
    <dl className="flex gap-2 sm:gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex-1 rounded-card border border-border bg-card px-3 py-2 text-center"
        >
          <dd className="font-heading text-lg font-semibold text-foreground">
            {stat.value}
          </dd>
          <dt className="text-2xs uppercase tracking-eyebrow text-muted-foreground">
            {stat.label}
          </dt>
        </div>
      ))}
    </dl>
  );
}
