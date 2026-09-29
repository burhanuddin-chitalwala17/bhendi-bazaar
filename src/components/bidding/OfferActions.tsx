"use client";

/**
 * Accept or decline an auction offer (winner-offer R4, R7).
 *
 * Opening the page decided nothing; this is where the bidder confirms. A decline takes a
 * second tap, because it hands the item to someone else and cannot be undone.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { readApiError } from "@/lib/api-error";

export function OfferActions({
  token,
  state,
  initialChoice,
}: {
  token: string;
  state: "open" | "accepted";
  initialChoice: "accept" | "decline" | null;
}) {
  const router = useRouter();
  const [confirmingDecline, setConfirmingDecline] = useState(initialChoice === "decline");
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const checkoutHref = `/bid-offer/${token}/checkout`;

  const respond = async (choice: "accept" | "decline") => {
    setPending(choice);
    try {
      const response = await fetch(`/api/bidding/offers/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      if (!response.ok) throw await readApiError(response);
      if (choice === "accept") {
        router.push(checkoutHref);
      } else {
        toast.success("Offer declined. Thank you for letting us know.");
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
      router.refresh();
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-tabbar z-30 space-y-2 border-t border-border bg-background/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      {confirmingDecline ? (
        <>
          <p className="text-sm">
            Reject this offer? The item goes to the next bidder, and you cannot take it back.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setConfirmingDecline(false)}
              disabled={pending !== null}
            >
              Keep my offer
            </Button>
            <Button
              variant="destructive"
              className="h-11"
              onClick={() => respond("decline")}
              disabled={pending !== null}
            >
              {pending === "decline" ? "Rejecting…" : "Yes, reject"}
            </Button>
          </div>
        </>
      ) : (
        <>
          {state === "accepted" ? (
            <Button asChild size="lg" className="h-12 w-full rounded-full text-sm font-semibold">
              <Link href={checkoutHref}>Continue to payment</Link>
            </Button>
          ) : (
            <Button
              size="lg"
              className="h-12 w-full rounded-full text-sm font-semibold"
              onClick={() => respond("accept")}
              disabled={pending !== null}
            >
              {pending === "accept" ? "Accepting…" : "Accept and continue to payment"}
            </Button>
          )}
          <Button
            variant="ghost"
            className="h-10 w-full text-sm"
            onClick={() => setConfirmingDecline(true)}
            disabled={pending !== null}
          >
            Reject the offer
          </Button>
        </>
      )}
    </div>
  );
}
