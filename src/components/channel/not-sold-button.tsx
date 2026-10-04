"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { readApiError } from "@/lib/api-error";
import type { Channel } from "@server/shared/channels";

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
  const [saving, setSaving] = useState(false);

  async function send() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/channels/not-sold", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, productType, kind, notSold: !marked }),
      });
      if (!response.ok) throw await readApiError(response);
      toast.success(marked ? `${label} is back on the list to decide` : `${label} marked not sold here`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record that decision");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      type="button"
      variant={marked ? "ghost" : "outline"}
      size="sm"
      className="min-h-10 shrink-0"
      onClick={send}
      disabled={saving}
    >
      {saving ? "Saving…" : marked ? "Decide where it goes" : "Not sold here"}
    </Button>
  );
}
