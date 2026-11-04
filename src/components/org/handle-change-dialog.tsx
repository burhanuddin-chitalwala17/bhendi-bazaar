"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

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
import { FormInput } from "@/components/shared/forms/FormField";
import { useServerForm } from "@/hooks/core/useServerForm";
import { orgStorefrontApiClient } from "@/components/org/orgStorefrontApiClient";
import {
  handleChangeSchema,
  type HandleChangeInput,
} from "@/lib/validation/schemas/storefront.schema";
import { formatDate } from "@/lib/format";

/**
 * Changing a shop's public address (org-handle R4, R4g, R4g1).
 *
 * The warning is the point of this component. An owner is told all four consequences
 * *before* confirming, with the real handles and the real date rather than a generic
 * caution — and confirming is a deliberate act in a dialog, not saving a form
 * alongside a tagline. A rename that silently 404s every card in circulation is the
 * failure this exists to prevent.
 *
 * The date arrives from the server rather than being computed here: the hold window is
 * server configuration a browser cannot see, so a client-side guess would keep saying
 * 180 days after the setting moved — and a warning that disagrees with the behaviour is
 * worse than no warning.
 */
export function HandleChangeDialog({
  orgId,
  currentHandle,
  oldAddressWorksUntil,
}: {
  orgId: string;
  currentHandle: string;
  /** ISO, from `storefrontService.previewChange` — the server's own window. */
  oldAddressWorksUntil: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const stopsWorking = formatDate(oldAddressWorksUntil, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const {
    register,
    onSubmit,
    formError,
    watch,
    formState: { errors, isSubmitting },
  } = useServerForm<HandleChangeInput>({
    schema: handleChangeSchema,
    defaultValues: { handle: "" },
    successMessage: "Your shop has a new address.",
    submit: (data) => orgStorefrontApiClient.changeHandle(orgId, data),
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  const next = watch("handle");

  // The button stays tappable (ADR-0053); a second tap while one change is in flight sends nothing.
  const busy = useRef(false);
  const submitOnce = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    try {
      await onSubmit(event);
    } catch {
      // Shown by useServerForm on the field or above the buttons; what was typed stays.
    } finally {
      busy.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Change address
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-overlay overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change your shop&apos;s address</DialogTitle>
          <DialogDescription>
            Your shop is at <strong>/store/{currentHandle}</strong> today.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submitOnce} className="space-y-4">
          <FormInput
            label="New address"
            placeholder="naaz-collection"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            {...register("handle")}
            error={errors.handle?.message}
          />

          {/* R4g: all four consequences, before confirming, with the real values. */}
          <div className="space-y-2 rounded-field border border-warning/40 bg-warning/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Icon name="warning" tone="warning" />
              Before you change it
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                <strong>/store/{currentHandle}</strong> keeps working until{" "}
                <strong>{stopsWorking}</strong>, then stops.
              </li>
              <li>
                After that it may be given to another shop — an old link could
                take your customers somewhere else.
              </li>
              <li>
                Update anything already printed, paid for or posted: cards,
                signage, advertisements, your social profiles.
              </li>
              <li>
                Search results for the old address will not fully carry over to{" "}
                {next ? <strong>/store/{next}</strong> : "the new one"}.
              </li>
            </ul>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Keep {currentHandle}
            </Button>
            {/* Never disabled (ADR-0053): an empty address submits and the field says why. */}
            <Button type="submit" aria-busy={isSubmitting}>
              {isSubmitting ? "Changing…" : "Change the address"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
