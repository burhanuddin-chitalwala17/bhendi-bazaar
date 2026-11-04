"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { channelsApiClient } from "@/components/channel/channelsApiClient";
import { useMutation } from "@/hooks/core/useMutation";
import type { Channel } from "@server/shared/channels";
import { NOT_SOLD_COPY } from "@/components/channel/channel-copy";

interface NotSoldButtonProps {
  channel: Channel;
  productType: string;
  kind: string | null;
  label: string;
  /** True on a type already marked, where the button is the way back. */
  marked: boolean;
}

/**
 * Records that a type does not sell on a channel, or takes it back
 * ([channel-registry](../../../docs/specs/channel-registry/) D12).
 *
 * Both directions are the same button because they are the same decision read from either side,
 * and because the way back has to be where the decision is — a choice you cannot find again is
 * worse than the nagging worklist it was meant to quiet.
 */
export function NotSoldButton({ channel, productType, kind, label, marked }: NotSoldButtonProps) {
  const router = useRouter();
  const { mutate, isLoading: saving } = useMutation(channelsApiClient.setNotSold, {
    successMessage: marked ? `${label} is back on the list to decide` : `${label} marked not sold here`,
    onSuccess: () => router.refresh(),
  });
  // useMutation has already shown the error; the rethrow is for callers that await it.
  const send = () => void mutate({ channel, productType, kind, notSold: !marked }).catch(() => {});

  return (
    <Button
      type="button"
      variant={marked ? "ghost" : "outline"}
      size="sm"
      className="min-h-10 shrink-0"
      onClick={send}
      disabled={saving}
    >
      {saving ? NOT_SOLD_COPY.saving : marked ? NOT_SOLD_COPY.marked : NOT_SOLD_COPY.mark}
    </Button>
  );
}
