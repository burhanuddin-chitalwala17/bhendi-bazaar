"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/core/useMutation";
import type { FeedChannel } from "@/lib/validation/schemas/org-channels.schema";

import { channelsApiClient } from "./channelsApiClient";
import { ACTION, FEED } from "./channel-copy";

/** Google and Meta need no account: on or off is one tap (decision parent Q7). */
export function FeedToggle({ orgId, channel, on }: { orgId: string; channel: FeedChannel; on: boolean }) {
  const router = useRouter();
  const toggle = useMutation(() => channelsApiClient.saveOrgChannels(orgId, { channels: [{ channel, enabled: !on }] }), {
    showToast: false,
    onSuccess: () => router.refresh(),
    onError: () => toast.error(FEED.failed),
  });

  return (
    <Button
      variant="outline"
      size="sm"
      className="min-h-10"
      aria-busy={toggle.isLoading}
      onClick={() => void toggle.mutate().catch(() => undefined)}
    >
      {toggle.isLoading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {on ? ACTION.turnOff : ACTION.turnOn}
    </Button>
  );
}
