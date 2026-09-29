"use client";

/**
 * The offer chain for one auction, for the platform (winner-offer R22, R23): who was offered
 * the item, in order, how each offer ended, and who holds it now. The one control ends the
 * current offer early and passes the item on; the server refuses while a payment is moving.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { readApiError } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";
import type { OfferChainEntry } from "@server/bidding/bidding.types";
import { formatPhone } from "@server/shared/phone";
import { BidCountdown } from "@/components/bidding/BidCountdown";

const STATUS_LABEL: Record<OfferChainEntry["status"], string> = {
  OFFERED: "Offered — awaiting reply",
  ACCEPTED: "Accepted — awaiting payment",
  DECLINED: "Declined",
  LAPSED: "Deadline passed",
  SKIPPED: "Skipped — no email",
  WITHDRAWN: "Withdrawn by the store",
  PAID: "Paid",
};

function statusLabel(entry: OfferChainEntry): string {
  // Open in the database but past its deadline: the next sweep moves it on.
  const overdue = !entry.isLive && (entry.status === "OFFERED" || entry.status === "ACCEPTED");
  return overdue ? "Deadline passed — moving on" : STATUS_LABEL[entry.status];
}

function when(value: Date | string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function OfferChain({
  eventId,
  chain,
  serverNow,
}: {
  eventId: string;
  chain: OfferChainEntry[];
  serverNow: string;
}) {
  const router = useRouter();
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  if (chain.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No offer has been made yet. The first goes out automatically when bidding closes.
      </p>
    );
  }

  const withdraw = async () => {
    setIsWithdrawing(true);
    try {
      const response = await fetch(`/api/admin/bidding/${eventId}/offers/withdraw`, {
        method: "POST",
      });
      if (!response.ok) throw await readApiError(response);
      toast.success("Offer withdrawn; the item has moved to the next bidder");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not withdraw the offer");
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <ol className="space-y-2">
      {chain.map((entry) => (
        <li key={entry.id}>
          <Card className="space-y-2 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">
                {entry.sequence}. {entry.bidderName} · {formatCurrency(entry.amountPaise)}
              </p>
              <span className="text-3xs uppercase tracking-label text-muted-foreground">
                {statusLabel(entry)}
              </span>
            </div>
            <p className="truncate text-2xs text-muted-foreground">
              {entry.bidderEmail ?? "no email"}
              {entry.bidderPhone && ` · ${formatPhone(entry.bidderPhone)}`}
            </p>
            {entry.status !== "SKIPPED" && (
              <p className="text-3xs text-muted-foreground">
                Offered {when(entry.createdAt)} · email{" "}
                {entry.emailSentAt ? `sent ${when(entry.emailSentAt)}` : "not sent yet"}
                {entry.respondedAt && ` · answered ${when(entry.respondedAt)}`}
                {entry.closedAt && ` · closed ${when(entry.closedAt)}`}
              </p>
            )}
            {entry.isLive && entry.expiresAt && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-2xs">
                  Time left:{" "}
                  <BidCountdown
                    endAt={new Date(entry.expiresAt).toISOString()}
                    serverNow={serverNow}
                    endedLabel="deadline passed"
                    className="font-semibold tabular-nums"
                  />
                </p>
                <Button size="sm" variant="outline" onClick={withdraw} disabled={isWithdrawing}>
                  {isWithdrawing ? "Withdrawing…" : "Withdraw and offer to next"}
                </Button>
              </div>
            )}
          </Card>
        </li>
      ))}
    </ol>
  );
}
