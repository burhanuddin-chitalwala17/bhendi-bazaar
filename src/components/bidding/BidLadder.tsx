"use client";

/**
 * The ladder, and recording what happened to it.
 *
 * This is the only screen in the product that names a bidder (spec R37), and the only
 * one that can end an event. Two outcomes, both final: someone bought it, or nobody
 * did — and either way the item goes back on sale afterwards (spec R39a).
 *
 * The amount defaults to the chosen bid but is editable, because the sale is settled in
 * a conversation and may land somewhere else. A difference demands a reason: the
 * organisation is paid on this figure, and months later the record has to be able to
 * explain a number that appears nowhere in the ladder (spec R43).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { readApiError } from "@/lib/api-error";
import { formatCurrency, paiseToRupees } from "@/lib/format";
import type { BidLadderEntry } from "@server/bidding/bidding.types";
import { formatPhone } from "@server/shared/phone";

interface StockLocation {
  orgAddressId: string;
  quantity: number;
  orgAddress: { name: string };
}

export function BidLadder({
  eventId,
  ladder,
  locations,
  canRecordOutcome,
}: {
  eventId: string;
  ladder: BidLadderEntry[];
  locations: StockLocation[];
  canRecordOutcome: boolean;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<BidLadderEntry | null>(null);
  const [unsoldOpen, setUnsoldOpen] = useState(false);

  if (ladder.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nobody bid on this one.
        {canRecordOutcome && " Mark it unsold to put the item back on sale."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {ladder.map((bid, index) => (
          <li key={bid.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {formatCurrency(bid.amountPaise)}
                  {index === 0 && (
                    <span className="ml-2 text-3xs uppercase tracking-label text-muted-foreground">
                      Highest
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-2xs text-muted-foreground">
                  {bid.bidderName}
                  {bid.bidderPhone && ` · ${formatPhone(bid.bidderPhone)}`}
                  {bid.bidderEmail && ` · ${bid.bidderEmail}`}
                  {!bid.bidderEmail && " · no email — cannot be emailed"}
                </p>
                <p className="mt-0.5 text-3xs text-muted-foreground">
                  {bid.isRegistered ? "Registered account" : "Guest"} ·{" "}
                  {new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(bid.placedAt))}
                </p>
              </div>
              {canRecordOutcome && (
                <Button size="sm" variant="outline" onClick={() => setChosen(bid)}>
                  They bought it
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>

      {canRecordOutcome && (
        <Button variant="outline" onClick={() => setUnsoldOpen(true)}>
          Nobody bought it
        </Button>
      )}

      <ConfirmSaleDialog
        eventId={eventId}
        bid={chosen}
        locations={locations}
        onClose={() => setChosen(null)}
        onDone={() => {
          setChosen(null);
          router.refresh();
        }}
      />

      <MarkUnsoldDialog
        eventId={eventId}
        open={unsoldOpen}
        onClose={() => setUnsoldOpen(false)}
        onDone={() => {
          setUnsoldOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function ConfirmSaleDialog({
  eventId,
  bid,
  locations,
  onClose,
  onDone,
}: {
  eventId: string;
  bid: BidLadderEntry | null;
  locations: StockLocation[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [orgAddressId, setOrgAddressId] = useState(locations[0]?.orgAddressId ?? "");
  const [isSaving, setIsSaving] = useState(false);

  if (!bid) return null;

  const bidRupees = paiseToRupees(bid.amountPaise);
  const entered = amount === "" ? bidRupees : Number(amount);
  const differs = entered !== bidRupees;

  const submit = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/bidding/${eventId}/sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bidId: bid.id,
          amount: entered,
          orgAddressId,
          reason: reason.trim() || undefined,
        }),
      });
      if (!response.ok) throw await readApiError(response);
      toast.success("Sale recorded");
      onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not record the sale"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record the sale</DialogTitle>
          <DialogDescription>
            {bid.bidderName} bought this for the amount below. The organisation is paid
            on this figure, one unit leaves stock, and the item goes back on sale.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="sale-amount" className="text-sm">
              Sold for (₹)
            </Label>
            <Input
              id="sale-amount"
              type="number"
              min="1"
              step="1"
              className="mt-1.5"
              placeholder={String(bidRupees)}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <p className="mt-1.5 text-2xs text-muted-foreground">
              Their bid was {formatCurrency(bid.amountPaise)}.
            </p>
          </div>

          <div>
            <Label htmlFor="sale-location" className="text-sm">
              Take the unit from
            </Label>
            <Select
              id="sale-location"
              className="mt-1.5"
              value={orgAddressId}
              onChange={(event) => setOrgAddressId(event.target.value)}
            >
              {locations.map((location) => (
                <option key={location.orgAddressId} value={location.orgAddressId}>
                  {location.orgAddress.name} ({location.quantity} in stock)
                </option>
              ))}
            </Select>
            {locations.length === 0 && (
              <p className="mt-1.5 text-sm text-destructive">
                No location holds stock of this product. The sale cannot be recorded.
              </p>
            )}
          </div>

          {differs && (
            <div>
              <Label htmlFor="sale-reason" className="text-sm">
                Why the amount differs <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="sale-reason"
                className="mt-1.5"
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Negotiated down after they saw it in person"
              />
              <p className="mt-1.5 text-2xs text-muted-foreground">
                Required: this is what explains the figure the organisation is paid on.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              isSaving ||
              locations.length === 0 ||
              !orgAddressId ||
              (differs && !reason.trim())
            }
          >
            {isSaving ? "Recording…" : "Record the sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkUnsoldDialog({
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
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/bidding/${eventId}/unsold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      if (!response.ok) throw await readApiError(response);
      toast.success("Recorded as unsold");
      onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not record the outcome"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nobody bought it?</DialogTitle>
          <DialogDescription>
            The item goes back on sale at its normal price and the organisation is owed
            nothing. Every bid stays on record.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="unsold-reason" className="text-sm">
            Note (optional)
          </Label>
          <Textarea
            id="unsold-reason"
            className="mt-1.5"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Top three bidders all backed out"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={isSaving}>
            {isSaving ? "Recording…" : "Mark unsold"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
