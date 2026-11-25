"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";
import { SOCIAL_PLATFORM } from "@server/channels/social/types";

import { channelsApiClient } from "./channelsApiClient";
import { ACTION, DISCONNECT, INSTAGRAM } from "./channel-copy";

interface DisconnectDialogProps {
  orgId: string;
  channel: MarketplaceChannel | typeof SOCIAL_PLATFORM.INSTAGRAM;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** What stops, what stays, and the one risk (decision Q9). A bottom sheet on phone, a dialog from md. */
export function DisconnectDialog({ orgId, channel, label, open, onOpenChange }: DisconnectDialogProps) {
  const router = useRouter();
  const disconnect = useMutation(() => channelsApiClient.disconnect(orgId, channel), {
    showToast: false,
    onSuccess: () => {
      toast.success(DISCONNECT.done(label));
      onOpenChange(false);
      router.refresh();
    },
  });

  // Instagram has nothing left selling at old stock, so no Watch out (connect-instagram ux.md copy deck).
  const lines =
    channel === SOCIAL_PLATFORM.INSTAGRAM
      ? { stops: INSTAGRAM.disconnect.stops, stays: INSTAGRAM.disconnect.stays, watchOut: null, revoke: INSTAGRAM.disconnect.revoke }
      : { stops: DISCONNECT.stops(label), stays: DISCONNECT.stays(label), watchOut: DISCONNECT.watchOut(label), revoke: DISCONNECT.revoke(channel, label) };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={DISCONNECT.title(label)}>
      <div className="flex flex-col gap-3 text-sm">
        <p>
          <span className="font-semibold">{DISCONNECT.stopsLabel}</span>
          {lines.stops}
        </p>
        <p>
          <span className="font-semibold">{DISCONNECT.staysLabel}</span>
          {lines.stays}
        </p>
        {lines.watchOut && (
          <p className="text-warning">
            <span className="font-semibold">{DISCONNECT.watchOutLabel}</span>
            {lines.watchOut}
          </p>
        )}
        <p className="text-muted-foreground">{lines.revoke}</p>
        {disconnect.error && (
          <p role="alert" className="text-destructive">
            {DISCONNECT.failed}
          </p>
        )}
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button
            variant="destructive"
            className="min-h-10"
            pending={disconnect.isLoading}
            onClick={() => void disconnect.mutate().catch(() => undefined)}
          >
            {disconnect.isLoading ? (
              DISCONNECT.working
            ) : disconnect.error ? (
              ACTION.tryAgain
            ) : (
              DISCONNECT.confirm
            )}
          </Button>
          <Button variant="outline" className="min-h-10" onClick={() => onOpenChange(false)}>
            {DISCONNECT.keep}
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
