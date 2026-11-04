"use client";

import { Button } from "@/components/ui/button";
import { ActionBar } from "@/components/shared/action-bar";
import { SHOP_DETAILS_COPY } from "./shop-details-copy";

/**
 * The page's one Save (org-profile Q30), shown only while something is unsaved. Sits on the phone's
 * tab bar and inline at the bottom of the column from md.
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
    <ActionBar className="-mx-4 md:mx-0" status={SHOP_DETAILS_COPY.unsaved}>
      <Button type="button" variant="outline" className="h-11" onClick={onDiscard}>
        {SHOP_DETAILS_COPY.discard}
      </Button>
      {/* Never disabled (ADR-0053): busy says so, and after 3 s says it is still going. */}
      <Button type="button" className="h-11" pending={saving} onClick={onSave}>
        {saving && slow ? SHOP_DETAILS_COPY.stillSaving : SHOP_DETAILS_COPY.save}
      </Button>
    </ActionBar>
  );
}
