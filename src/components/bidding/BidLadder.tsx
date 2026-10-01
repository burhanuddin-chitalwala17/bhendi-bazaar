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
import { formatCurrency, paiseToRupees } from "@/lib/format";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  confirmSaleSchema,
  type ConfirmSaleBody,
} from "@/lib/validation/schemas/bidding.schema";
import { biddingApiClient } from "@/components/bidding/biddingApiClient";
import { MarkUnsoldDialog } from "@/components/bidding/MarkUnsoldDialog";
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setChosen(bid)}
                >
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

      {/* Keyed by the bid, so choosing another bidder starts from their figure. */}
      {chosen && (
        <ConfirmSaleDialog
          key={chosen.id}
          eventId={eventId}
          bid={chosen}
          locations={locations}
          onClose={() => setChosen(null)}
          onDone={() => {
            setChosen(null);
            router.refresh();
          }}
        />
      )}

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
  bid: BidLadderEntry;
  locations: StockLocation[];
  onClose: () => void;
  onDone: () => void;
}) {
  const bidRupees = paiseToRupees(bid.amountPaise);

  const form = useServerForm<ConfirmSaleBody>({
    schema: confirmSaleSchema,
    defaultValues: {
      // No amount: the box starts empty, and an empty box reads as the bid itself.
      bidId: bid.id,
      orgAddressId: locations[0]?.orgAddressId ?? "",
      reason: "",
    },
    submit: (data) =>
      biddingApiClient.confirmSale(eventId, {
        ...data,
        reason: data.reason || undefined,
      }),
    successMessage: "Sale recorded",
    onSuccess: onDone,
  });
  const {
    register,
    watch,
    formState: { errors },
    onSubmit,
    formError,
    isSubmitting,
  } = form;

  const amount = watch("amount");
  const differs = amount !== undefined && amount !== bidRupees;
  const orgAddressId = watch("orgAddressId");
  const reason = watch("reason") ?? "";

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record the sale</DialogTitle>
          <DialogDescription>
            {bid.bidderName} bought this for the amount below. The organisation
            is paid on this figure, one unit leaves stock, and the item goes
            back on sale.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {(formError || errors.bidId?.message) && (
            <p className="text-sm text-destructive">
              {errors.bidId?.message ?? formError}
            </p>
          )}

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
              aria-invalid={!!errors.amount}
              {...register("amount", {
                setValueAs: (value) =>
                  value === "" ? bidRupees : Number(value),
              })}
            />
            <p className="mt-1.5 text-2xs text-muted-foreground">
              Their bid was {formatCurrency(bid.amountPaise)}.
            </p>
            {errors.amount?.message && (
              <p className="mt-1.5 text-sm text-destructive">
                {errors.amount.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="sale-location" className="text-sm">
              Take the unit from
            </Label>
            <Select
              id="sale-location"
              className="mt-1.5"
              {...register("orgAddressId")}
            >
              {locations.map((location) => (
                <option
                  key={location.orgAddressId}
                  value={location.orgAddressId}
                >
                  {location.orgAddress.name} ({location.quantity} in stock)
                </option>
              ))}
            </Select>
            {locations.length === 0 && (
              <p className="mt-1.5 text-sm text-destructive">
                No location holds stock of this product. The sale cannot be
                recorded.
              </p>
            )}
            {errors.orgAddressId?.message && (
              <p className="mt-1.5 text-sm text-destructive">
                {errors.orgAddressId.message}
              </p>
            )}
          </div>

          {differs && (
            <div>
              <Label htmlFor="sale-reason" className="text-sm">
                Why the amount differs{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="sale-reason"
                className="mt-1.5"
                rows={2}
                placeholder="Negotiated down after they saw it in person"
                aria-invalid={!!errors.reason}
                {...register("reason")}
              />
              <p className="mt-1.5 text-2xs text-muted-foreground">
                Required: this is what explains the figure the organisation is
                paid on.
              </p>
              {errors.reason?.message && (
                <p className="mt-1.5 text-sm text-destructive">
                  {errors.reason.message}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void onSubmit().catch(() => {})}
            disabled={
              isSubmitting ||
              locations.length === 0 ||
              !orgAddressId ||
              (differs && !reason.trim())
            }
          >
            {isSubmitting ? "Recording…" : "Record the sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
