"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { readApiError } from "@/lib/api-error";

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
  const [isCancelling, setIsCancelling] = useState(false);

  const cancel = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch(apiPath, { method: "DELETE" });
      if (!response.ok) throw await readApiError(response);
      toast.success("Bidding cancelled");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not cancel this event"
      );
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Cancel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Call this off?</DialogTitle>
          <DialogDescription>
            {hasBids
              ? "People have already bid on this item. Cancelling withdraws it from bidding and tells everyone who bid. The bids stay on record."
              : "The item goes back on sale immediately. Nobody has bid, so nobody is affected."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep it running
          </Button>
          <Button variant="destructive" onClick={cancel} disabled={isCancelling}>
            {isCancelling ? "Cancelling…" : "Cancel bidding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
