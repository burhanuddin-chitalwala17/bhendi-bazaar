"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";

import { channelsApiClient } from "./channelsApiClient";
import { LISTINGS, ROW } from "./listing-copy";

/** "Read again" (R2). A tap while a read runs is harmless: the job claims one read at a time (D3). */
export function ReadAgainButton({ orgId, channel }: { orgId: string; channel: MarketplaceChannel }) {
  const router = useRouter();
  const read = useMutation(() => channelsApiClient.readListings(orgId, channel), {
    showToast: false,
    onSuccess: () => {
      toast(LISTINGS.readingAgain);
      router.refresh();
    },
    onError: (error) => toast.error(error.message || ROW.failed),
  });
  return (
    <Button
      variant="outline"
      className="min-h-10 w-full md:w-auto"
      onClick={() => void read.mutate().catch(() => undefined)}
      aria-busy={read.isLoading}
    >
      {read.isLoading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {LISTINGS.readAgain}
    </Button>
  );
}
