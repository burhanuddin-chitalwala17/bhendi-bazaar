"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LockedAction } from "@/components/subscriptions/locked-action";
import { useMutation } from "@/hooks/core/useMutation";
import type { FeedChannel } from "@/lib/validation/schemas/org-channels.schema";

import { channelsApiClient } from "./channelsApiClient";
import { ACTION, FEED } from "./channel-copy";
import { FEATURE } from "@/components/subscriptions/features";

/** Google and Meta need no account: on or off is one tap (decision parent Q7). */
export function FeedToggle({ orgId, channel, on }: { orgId: string; channel: FeedChannel; on: boolean }) {
  const router = useRouter();
  const toggle = useMutation(() => channelsApiClient.saveOrgChannels(orgId, { channels: [{ channel, enabled: !on }] }), {
    showToast: false,
    onSuccess: () => router.refresh(),
    onError: () => toast.error(FEED.failed),
  });

  const button = (
    <Button
      variant="outline"
      size="sm"
      className="min-h-10"
      pending={toggle.isLoading}
      onClick={() => void toggle.mutate().catch(() => undefined)}
    >
      {on ? ACTION.turnOff : ACTION.turnOn}
    </Button>
  );
  // Turning a feed on is part of Channels; turning it off never locks (feature-access Q4).
  if (on) return button;
  return (
    <LockedAction feature={FEATURE.CHANNELS} label={ACTION.turnOn} variant="outline" size="sm" className="min-h-10">
      {button}
    </LockedAction>
  );
}
