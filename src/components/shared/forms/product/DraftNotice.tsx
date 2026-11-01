"use client";

import { Button } from "@/components/ui/button";
import type { FoundDraft } from "@/hooks/forms/useFormPersist";
import { draftNotice, staleDraftNotice } from "./edit-overview";

/**
 * A draft kept on this device (product-form R8, D9): a recent one is already back with "Discard";
 * one older than a week waits for "Use it" or "Start fresh" (ux Partial, Stale).
 */
export function DraftNotice({
  found,
  onDiscard,
  onUse,
}: {
  found: FoundDraft | null;
  onDiscard: () => void;
  onUse: () => void;
}) {
  if (!found) return null;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-card border border-border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span>{found.stale ? staleDraftNotice(found.savedAt) : draftNotice(found.savedAt)}</span>
      <div className="flex gap-2">
        {found.stale && (
          <Button type="button" size="sm" onClick={onUse}>
            Use it
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={onDiscard}>
          {found.stale ? "Start fresh" : "Discard"}
        </Button>
      </div>
    </div>
  );
}
