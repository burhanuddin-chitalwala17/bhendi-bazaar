"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMutation } from "@/hooks/core/useMutation";
import { biddingApiClient } from "@/components/bidding/biddingApiClient";
import { CANCEL_BIDDING_COPY } from "./bidding-copy";

/**
 * Calling an event off (spec R11).
 *
 * Confirmed rather than immediate, and the confirmation says something different once
 * bids exist: cancelling then is withdrawing an item people have already offered money
 * for, which is a different act from cancelling one nobody has touched.
 */
export function CancelBiddingButton({
  apiPath,
  hasBids,
}: {
  apiPath: string;
  hasBids: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { mutate, isLoading: isCancelling } = useMutation(
    () => biddingApiClient.cancel(apiPath),
    {
      successMessage: CANCEL_BIDDING_COPY.biddingCancelled,
      onSuccess: () => {
        setOpen(false);
        router.refresh();
      },
    },
  );

  // The toast is the whole report; the rejection has nowhere further to go.
  const cancel = () => mutate().catch(() => {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">{CANCEL_BIDDING_COPY.cancel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{CANCEL_BIDDING_COPY.callOff}</DialogTitle>
          <DialogDescription>
            {hasBids
              ? CANCEL_BIDDING_COPY.peopleHaveAlreadyBid
              : CANCEL_BIDDING_COPY.itemGoesBackSale}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{CANCEL_BIDDING_COPY.keepRunning}</Button>
          <Button
            variant="destructive"
            onClick={cancel}
            disabled={isCancelling}
          >
            {isCancelling ? CANCEL_BIDDING_COPY.cancelling : CANCEL_BIDDING_COPY.cancelBidding}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
