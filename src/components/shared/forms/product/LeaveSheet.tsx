"use client";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { LEAVE_SHEET_COPY } from "./product-copy";

/** "Leave without saving?" (product-form R8, ux copy deck). Closing it any other way keeps editing. */
export function LeaveSheet({
  open,
  body,
  onStay,
  onLeave,
}: {
  open: boolean;
  body: string;
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onStay();
      }}
      title={LEAVE_SHEET_COPY.leaveWithoutSaving}
      description={body}
    >
      <div className="flex flex-col gap-2 md:flex-row-reverse">
        <Button type="button" className="min-h-10" onClick={onStay}>
          {LEAVE_SHEET_COPY.keepEditing}
        </Button>
        <Button type="button" variant="outline" className="min-h-10" onClick={onLeave}>
          {LEAVE_SHEET_COPY.leave}
        </Button>
      </div>
    </FormDialog>
  );
}
