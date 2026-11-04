"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";

import { channelsApiClient } from "./channelsApiClient";
import { ACTION, DISCONNECT } from "./channel-copy";

interface DisconnectDialogProps {
  orgId: string;
  channel: MarketplaceChannel;
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

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={DISCONNECT.title(label)}>
      <div className="flex flex-col gap-3 text-sm">
        <p>
          <span className="font-semibold">Stops: </span>
          {DISCONNECT.stops(label)}
        </p>
        <p>
          <span className="font-semibold">Stays: </span>
          {DISCONNECT.stays(label)}
        </p>
        <p className="text-warning">
          <span className="font-semibold">Watch out: </span>
          {DISCONNECT.watchOut(label)}
        </p>
        <p className="text-muted-foreground">{DISCONNECT.revoke(channel, label)}</p>
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
