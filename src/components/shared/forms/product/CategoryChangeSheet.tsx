"use client";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { CATEGORY_SHEET } from "./category-change";
import type { PendingCategoryChange } from "./useCategoryChange";

/**
 * "Change to Ring?" before answers are left behind (product-form R6, ux Refused). Closing it any
 * other way keeps the old category, the safe side of a mis-tap.
 */
export function CategoryChangeSheet({
  pending,
  onKeep,
  onChange,
}: {
  pending: PendingCategoryChange | null;
  onKeep: () => void;
  onChange: () => void;
}) {
  return (
    <FormDialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) onKeep();
      }}
      title={pending ? CATEGORY_SHEET.title(pending.toName) : ""}
      description={pending ? CATEGORY_SHEET.body(pending.lost, pending.toName) : undefined}
    >
      {pending && (
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button type="button" className="min-h-10" onClick={onChange}>
            {CATEGORY_SHEET.change(pending.toName)}
          </Button>
          <Button type="button" variant="outline" className="min-h-10" onClick={onKeep}>
            {CATEGORY_SHEET.keep(pending.fromName)}
          </Button>
        </div>
      )}
    </FormDialog>
  );
}
