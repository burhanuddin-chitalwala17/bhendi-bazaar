"use client";

/**
 * Placing a bid. Three things here are requirements rather than choices.
 *
 * Who is leading is never shown, only the amount — the view it receives has no field
 * for it (spec R16). A bid is the current high plus an increase, never a free-standing
 * figure, so both controls work in increases and show the total before the tap (R13);
 * `expectedHighestBid` rides along, so a price that moved gets a refusal rather than a
 * bid the bidder did not intend (R24). And the email box says what leaving it blank
 * costs at the moment of choosing, not afterwards (R22a).
 */

import { useCallback, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField, FormInput, fieldMessageIds } from "@/components/shared/forms/FormField";
import { PhoneInput } from "@/components/ui/phone-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BidCountdown } from "@/components/bidding/BidCountdown";
import { ApiError, applyServerErrors } from "@/lib/api-error";
import { formatCurrency, paiseToRupees, rupeesToPaise } from "@/lib/format";
import { useMutation } from "@/hooks/core/useMutation";
import {
  biddingApiClient,
  type BidStateView,
} from "@/components/bidding/biddingApiClient";
import type { PlaceBidInputBody } from "@/lib/validation/schemas/bidding.schema";
import { BID_PANEL_COPY } from "./bidding-copy";


export function BidPanel({
  slug,
  endAt,
  serverNow,
  isSignedIn,
  quickBidsPaise,
  initial,
}: {
  slug: string;
  endAt: string;
  serverNow: string;
  isSignedIn: boolean;
  quickBidsPaise: number[];
  initial: BidStateView;
}) {
  const [state, setState] = useState<BidStateView>(initial);
  const [customIncrease, setCustomIncrease] = useState("");
  const [guest, setGuest] = useState({ name: "", phone: "", email: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [placed, setPlaced] = useState<number | null>(null);
  const [hasExpired, setHasExpired] = useState(false);
  const [isBehind, setIsBehind] = useState(false);

  const onExpire = useCallback(() => setHasExpired(true), []);

  const minIncrease = Math.min(...quickBidsPaise);
  const isOpeningBid = state.highestBidPaise === null;

  const { mutate: placeBid, isLoading: isPlacing } = useMutation(
    (body: PlaceBidInputBody) => biddingApiClient.placeBid(slug, body),
    {
      showToast: false,
      onError: (error) => {
        if (!(error instanceof ApiError)) {
          toast.error(BID_PANEL_COPY.couldNotPlaceBid);
          return;
        }
        // A refusal means this page is behind the event — the price moved, or it
        // closed. The server deliberately names no amount (money is formatted in one
        // place, client-side), so the honest offer is a reload (spec R24).
        if (error.status === 409) setIsBehind(true);
        const byField: Record<string, string> = {};
        applyServerErrors(error.details, (path, { message }) => {
          byField[path] = message;
        });
        setFieldErrors(byField);
        if (Object.keys(byField).length === 0) toast.error(error.message);
        else if (byField.amount) toast.error(byField.amount);
      },
    },
  );

  const place = async (amountPaise: number) => {
    setFieldErrors({});
    try {
      const view = await placeBid({
        amount: paiseToRupees(amountPaise),
        expectedHighestBid: state.highestBidPaise,
        ...(isSignedIn
          ? {}
          : {
              guestName: guest.name,
              guestPhone: guest.phone,
              guestEmail: guest.email || undefined,
            }),
      });
      setState(view);
      setPlaced(amountPaise);
      setCustomIncrease("");
      setIsBehind(false);
      toast.success(BID_PANEL_COPY.yourBidIsIn);
    } catch {
      // Reported by onError above.
    }
  };

  if (hasExpired) {
    return (
      <div className="rounded-card border border-border bg-card p-4 text-center">
        <p className="text-sm font-medium">{BID_PANEL_COPY.biddingHasClosed}</p>
        <p className="mt-1 text-2xs text-muted-foreground">{BID_PANEL_COPY.reloadPageSeeFinal}</p>
      </div>
    );
  }

  const customPaise = customIncrease
    ? rupeesToPaise(Number(customIncrease))
    : 0;
  const customTotal = (state.highestBidPaise ?? 0) + customPaise;
  const canSubmitCustom =
    customPaise >= minIncrease &&
    customTotal >= state.minBidPaise &&
    customTotal <= state.maxBidPaise;

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-border bg-card p-4">
        <p className="text-2xs uppercase tracking-label text-muted-foreground">
          {isOpeningBid ? BID_PANEL_COPY.openingBid : BID_PANEL_COPY.highestBid}
        </p>
        <p className="mt-1 font-heading text-3xl font-bold sm:text-4xl">
          {formatCurrency(state.highestBidPaise ?? state.minBidPaise)}
        </p>
        <p className="mt-1 text-2xs text-muted-foreground">
          {state.bidCount === 0
            ? BID_PANEL_COPY.noBidsYetFirst
            : `${state.bidCount} bid${state.bidCount === 1 ? "" : "s"} so far`}
        </p>
        <p className="mt-3 text-sm font-medium tabular-nums">
          <span className="text-2xs uppercase tracking-label text-muted-foreground">
            Closes in{" "}
          </span>
          <BidCountdown
            endAt={endAt}
            serverNow={serverNow}
            onExpire={onExpire}
          />
        </p>
      </div>

      {isBehind && (
        <div className="space-y-2 rounded-card border border-warning/40 bg-warning/10 p-3">
          <p className="text-sm font-medium">{BID_PANEL_COPY.pageBehind}</p>
          <p className="text-2xs text-muted-foreground">{BID_PANEL_COPY.someoneBidWhileWere}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => window.location.reload()}
          >{BID_PANEL_COPY.reload}</Button>
        </div>
      )}

      {placed !== null && (
        <div className="flex items-start gap-2 rounded-card border border-success/40 bg-success/10 p-3 text-success">
          <Icon name="done" size="sm" className="mt-0.5" />
          <div>
            <p className="text-sm font-medium">
              Your bid of {formatCurrency(placed)} is in
            </p>
            <p className="text-2xs opacity-90">{BID_PANEL_COPY.canKeepBiddingLong}</p>
          </div>
        </div>
      )}

      {!isSignedIn && (
        <div className="space-y-3 rounded-card border border-border bg-card p-4">
          <p className="text-2xs uppercase tracking-label text-muted-foreground">{BID_PANEL_COPY.yourDetails}</p>
          <FormInput
            label={BID_PANEL_COPY.name}
            required
            value={guest.name}
            onChange={(event) =>
              setGuest({ ...guest, name: event.target.value })
            }
            error={fieldErrors.guestName}
            autoComplete="name"
          />
          <FormField id="bid-phone" label={BID_PANEL_COPY.phone} required error={fieldErrors.guestPhone}>
            <PhoneInput
              id="bid-phone"
              value={guest.phone}
              onChange={(phone) => setGuest({ ...guest, phone })}
              aria-invalid={!!fieldErrors.guestPhone}
              aria-describedby={fieldErrors.guestPhone ? fieldMessageIds("bid-phone").error : undefined}
            />
          </FormField>
          <div>
            <Label htmlFor="bid-email" className="text-sm">{BID_PANEL_COPY.email}</Label>
            <Input
              id="bid-email"
              type="email"
              className="mt-1.5"
              value={guest.email}
              onChange={(event) =>
                setGuest({ ...guest, email: event.target.value })
              }
              aria-invalid={!!fieldErrors.guestEmail}
              aria-describedby="bid-email-hint"
              autoComplete="email"
            />
            {/* R22a: the cost of leaving this blank, at the moment of choosing. */}
            <p
              id="bid-email-hint"
              className="mt-1.5 text-2xs text-muted-foreground"
            >{BID_PANEL_COPY.optionalButWithoutThere}</p>
            {fieldErrors.guestEmail && (
              <p className="mt-1 text-sm text-destructive">
                {fieldErrors.guestEmail}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isOpeningBid ? (
          <Button
            size="lg"
            className="h-12 w-full rounded-full text-sm font-semibold"
            disabled={isPlacing}
            onClick={() => place(state.minBidPaise)}
          >
            {isPlacing
              ? BID_PANEL_COPY.placing
              : `Bid ${formatCurrency(state.minBidPaise)}`}
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {quickBidsPaise
              .filter(
                (step) =>
                  (state.highestBidPaise ?? 0) + step <= state.maxBidPaise,
              )
              .map((step) => (
                <Button
                  key={step}
                  size="lg"
                  className="h-12 rounded-full text-sm font-semibold"
                  disabled={isPlacing}
                  onClick={() => place((state.highestBidPaise ?? 0) + step)}
                >
                  +{formatCurrency(step)}
                </Button>
              ))}
          </div>
        )}

        {!isOpeningBid && (
          <div className="rounded-card border border-border bg-card p-3">
            <Label htmlFor="bid-custom" className="text-sm">{BID_PANEL_COPY.addOwnAmount}</Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="bid-custom"
                type="number"
                inputMode="numeric"
                min={paiseToRupees(minIncrease)}
                max={paiseToRupees(
                  state.maxBidPaise - (state.highestBidPaise ?? 0),
                )}
                step="1"
                placeholder={`${paiseToRupees(minIncrease)} or more`}
                value={customIncrease}
                onChange={(event) => setCustomIncrease(event.target.value)}
                aria-invalid={!!fieldErrors.amount}
              />
              <Button
                size="lg"
                className="shrink-0 rounded-full"
                disabled={isPlacing || !canSubmitCustom}
                onClick={() => place(customTotal)}
              >{BID_PANEL_COPY.bid}</Button>
            </div>
            <p className="mt-1.5 text-2xs text-muted-foreground">
              Add between {formatCurrency(minIncrease)} and{" "}
              {formatCurrency(state.maxBidPaise - (state.highestBidPaise ?? 0))}
              {customPaise > 0 && canSubmitCustom && (
                <> — your bid would be {formatCurrency(customTotal)}</>
              )}
            </p>
            {fieldErrors.amount && (
              <p className="mt-1 text-sm text-destructive">
                {fieldErrors.amount}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
