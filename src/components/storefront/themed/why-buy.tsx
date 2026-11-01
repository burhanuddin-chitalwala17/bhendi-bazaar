import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { SectionVariant } from "@server/catalog/storefront-themes";
import type { WhyBuySlice } from "./page-data";
import { SectionHeading } from "./section-heading";

/**
 * "Why buy from us" (Q21, R8): facts the platform derived, then the shop's own claims drawn
 * apart from them, so a buyer can tell what was measured from what was stated (A7).
 */
export function ThemedWhyBuy({
  variant,
  facts,
  claims,
}: WhyBuySlice & { variant: SectionVariant<"whyBuy"> }) {
  const strip = variant === "strip";
  return (
    <section className="mx-auto max-w-store space-y-4 px-gutter py-section">
      <SectionHeading title="Why buy from us" align={variant === "tiles" ? "center" : "start"} />
      <ul
        aria-label={`What ${APP_NAME} knows about this shop`}
        className={cn(
          variant === "list" && "divide-y divide-border border-y border-border",
          variant === "tiles" && "grid grid-cols-2 gap-grid md:grid-cols-4",
          strip && "no-scrollbar -mx-gutter flex gap-grid overflow-x-auto px-gutter",
        )}
      >
        {facts.map((fact) => (
          <li
            key={fact.key}
            className={cn(
              variant === "list" && "py-3 font-label text-tag uppercase tracking-tag",
              variant === "tiles" && "border border-border p-4 text-center text-body",
              strip && "shrink-0 rounded-field bg-muted px-4 py-2 text-body",
            )}
          >
            {fact.text}
            {fact.note && (
              <span className="mt-1 block whitespace-pre-line break-words text-tag normal-case tracking-normal text-muted-foreground">
                {fact.note}
              </span>
            )}
          </li>
        ))}
      </ul>
      {claims.length > 0 && (
        <ul aria-label="What the shop says" className="space-y-2">
          {claims.map((claim) => (
            <li key={claim.label} className="border-l-2 border-primary pl-3 text-body italic">
              {claim.label}
              {claim.detail && <span className="text-muted-foreground"> — {claim.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
