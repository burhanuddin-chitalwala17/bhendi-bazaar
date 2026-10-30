import { ChevronDown } from "lucide-react";

import { APP_NAME } from "@/lib/config";
import { RETURNS_PRESET_LABEL } from "@server/catalog/shop-details.types";
import type { PoliciesSlice } from "./sections";

/**
 * The shop's delivery and returns terms, in a collapsed disclosure: a stranger reads them
 * once they are ready to buy, not on the first screen. Native `<details>` so the page stays
 * a server component with no script behind a toggle.
 *
 * Unambiguous whose promise this is (storefront-pages R3a): payment and fraud protection
 * stay the platform's and are not a shop's to disclaim.
 */
export function ShopPolicies({ name, preset, note }: PoliciesSlice) {
  return (
    <details className="group rounded-card border border-border bg-card">
      {/* min-h-11 keeps the tap target past 40px on a phone (ADR-0015). */}
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-heading text-base font-semibold [&::-webkit-details-marker]:hidden">
        This shop&apos;s terms
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
        <p className="text-2xs text-muted-foreground">
          Set by {name}. Payment and fraud protection are {APP_NAME}&apos;s.
        </p>
        <div>
          <h3 className="text-sm font-medium">Returns</h3>
          <p className="text-sm text-muted-foreground">{RETURNS_PRESET_LABEL[preset]}</p>
        </div>
        {note && (
          <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{note}</p>
        )}
      </div>
    </details>
  );
}
