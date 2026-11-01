"use client";

import { Button } from "@/components/ui/button";
import { SHOP_DETAILS_COPY } from "./shop-details-copy";

/**
 * The page's one Save (org-profile Q30), shown only while something is unsaved. Sits on the phone's
 * tab bar and at the bottom of the column from md, like the offer form's actions.
 */
export function SaveBar({
  changed,
  saving,
  slow,
  onSave,
  onDiscard,
}: {
  changed: boolean;
  saving: boolean;
  slow: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!changed && !saving) return null;
  return (
    <div
      role="region"
      aria-label={SHOP_DETAILS_COPY.unsaved}
      className="sticky bottom-tabbar z-10 -mx-4 flex items-center gap-2 border-t border-border bg-background/95 p-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-card md:border"
    >
      <p className="min-w-0 flex-1 text-sm font-medium">{SHOP_DETAILS_COPY.unsaved}</p>
      <Button type="button" variant="outline" className="h-11" onClick={onDiscard}>
        {SHOP_DETAILS_COPY.discard}
      </Button>
      {/* Never disabled (ADR-0053): busy says so, and after 3 s says it is still going. */}
      <Button type="button" className="h-11" aria-busy={saving} onClick={onSave}>
        {saving && slow ? SHOP_DETAILS_COPY.stillSaving : SHOP_DETAILS_COPY.save}
      </Button>
    </div>
  );
}
