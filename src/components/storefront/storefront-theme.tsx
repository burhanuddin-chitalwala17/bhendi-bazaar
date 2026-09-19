import type { ReactNode } from "react";

import type { Storefront } from "@/data-access-layer/storefront.dal";

/**
 * Wraps a shop's own content so its accent applies to it and nothing else.
 *
 * The accent is a token name on a data attribute, resolved by the `.storefront[...]`
 * scopes in `globals.css` — no inline style, no colour value crossing from the
 * database into a `className` (ADR-0022). A shop with no accent renders the attribute
 * absent and inherits the platform's primary, which is the default rather than a
 * special case.
 *
 * Deliberately inside the layout's chrome: the navbar, tab bar and footer belong to
 * the platform and must not take a shop's colour.
 */
export function StorefrontTheme({
  shop,
  children,
}: {
  shop: Pick<Storefront, "accent">;
  children: ReactNode;
}) {
  return (
    <div className="storefront" data-accent={shop.accent ?? undefined}>
      {children}
    </div>
  );
}
