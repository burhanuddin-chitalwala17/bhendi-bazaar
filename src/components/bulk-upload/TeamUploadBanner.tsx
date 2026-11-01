"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEAM_BULK_COPY } from "@server/catalog/bulk/sheet-copy";

/** The team uploading for a shop: whose products these become, and why (own-store/bulk-sheet R9). */
export function TeamUploadBanner({
  shopName,
  reason,
  error,
  onReason,
}: {
  shopName: string;
  reason: string;
  error: string | null;
  onReason: (value: string) => void;
}) {
  return (
    <div role="note" className="space-y-3 rounded-card border border-primary/30 bg-primary/5 p-3">
      <p className="break-words text-sm font-medium text-foreground">{TEAM_BULK_COPY.banner(shopName)}</p>
      <div className="space-y-1">
        <Label htmlFor="team-bulk-reason" required>{TEAM_BULK_COPY.reasonLabel}</Label>
        <Input
          id="team-bulk-reason"
          value={reason}
          maxLength={200}
          aria-invalid={!!error}
          aria-describedby={error ? "team-bulk-reason-error" : undefined}
          onChange={(event) => onReason(event.target.value)}
        />
        {error && (
          <p id="team-bulk-reason-error" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
