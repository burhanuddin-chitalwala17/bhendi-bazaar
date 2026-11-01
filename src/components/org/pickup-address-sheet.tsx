"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { LocationForm, type LocationFormActions } from "@/components/org/location-form";
import { HANDOFF_WIDE, HandoffSheet } from "@/components/shared/overlays/handoff-sheet";
import type { OrgLocation } from "@server/catalog/org.address.types";
import { PICKUP_ADDRESS_COPY, STILL_SAVING_AFTER_MS } from "./pickup-address-copy";

interface Props {
  orgId: string;
  /** The control that opens it. */
  trigger: ReactNode;
  /** The saved address, for the opener to show selected. */
  onAdded: (location: OrgLocation) => void;
}

/**
 * A pickup address created over whatever needed it (own-store onboarding D11, Q12, Q26). The opener
 * stays mounted underneath, so what was typed there survives a save or a failure.
 */
export function PickupAddressSheet({ orgId, trigger, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <HandoffSheet
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={PICKUP_ADDRESS_COPY.title}
      closeLabel={PICKUP_ADDRESS_COPY.close}
      wide={HANDOFF_WIDE.SIDE}
    >
      <LocationForm
        orgId={orgId}
        location={null}
        messages={{ success: PICKUP_ADDRESS_COPY.added, retry: PICKUP_ADDRESS_COPY.retry }}
        actions={(state) => <SaveAddressButton {...state} />}
        onDone={(location) => {
          onAdded(location);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </HandoffSheet>
  );
}

/** Never disabled (ADR-0053): the form ignores a press while it is already saving. */
function SaveAddressButton({ isSubmitting, failed }: LocationFormActions) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!isSubmitting) return;
    const timer = setTimeout(() => setSlow(true), STILL_SAVING_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [isSubmitting]);

  const label = isSubmitting
    ? slow ? PICKUP_ADDRESS_COPY.stillSaving : PICKUP_ADDRESS_COPY.saving
    : failed ? PICKUP_ADDRESS_COPY.tryAgain : PICKUP_ADDRESS_COPY.save;
  return (
    <Button type="submit" className="min-h-11 w-full" aria-busy={isSubmitting}>
      {label}
    </Button>
  );
}
