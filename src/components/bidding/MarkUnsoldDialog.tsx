"use client";

/** Recording that nobody bought it: the item goes back on sale and the org is owed nothing. */

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  markUnsoldSchema,
  type MarkUnsoldBody,
} from "@/lib/validation/schemas/bidding.schema";
import { biddingApiClient } from "@/components/bidding/biddingApiClient";
import { MARK_UNSOLD_COPY } from "./bidding-copy";

export function MarkUnsoldDialog({
  eventId,
  open,
  onClose,
  onDone,
}: {
  eventId: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const form = useServerForm<MarkUnsoldBody>({
    schema: markUnsoldSchema,
    defaultValues: { reason: "" },
    submit: (data) =>
      biddingApiClient.markUnsold(eventId, {
        reason: data.reason || undefined,
      }),
    successMessage: MARK_UNSOLD_COPY.recordedUnsold,
    onSuccess: onDone,
  });
  const {
    register,
    formState: { errors },
    onSubmit,
    formError,
    isSubmitting,
  } = form;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{MARK_UNSOLD_COPY.nobodyBought}</DialogTitle>
          <DialogDescription>{MARK_UNSOLD_COPY.itemGoesBackSale}</DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="unsold-reason" className="text-sm">{MARK_UNSOLD_COPY.noteOptional}</Label>
          <Textarea
            id="unsold-reason"
            className="mt-1.5"
            rows={2}
            placeholder={MARK_UNSOLD_COPY.topThreeBiddersAll}
            aria-invalid={!!errors.reason}
            {...register("reason")}
          />
          {(errors.reason?.message || formError) && (
            <p className="mt-1.5 text-sm text-destructive">
              {errors.reason?.message ?? formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{MARK_UNSOLD_COPY.cancel}</Button>
          <Button variant="destructive" onClick={() => void onSubmit().catch(() => {})} disabled={isSubmitting}>
            {isSubmitting ? MARK_UNSOLD_COPY.recording : MARK_UNSOLD_COPY.markUnsold}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
