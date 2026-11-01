import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ListingIssue } from "@server/channels/platform-listing.types";

import { PUBLISH } from "./platform-listing-copy";

/** The chip that says whose value a field holds (channel-listings Q8): text, never colour alone. */
export function OwnerChip({ kind, text }: { kind: "product" | "own" | "theirs"; text: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 whitespace-nowrap font-medium",
        kind === "own" && "border-transparent bg-info/10 text-info",
        kind === "theirs" && "border-transparent bg-warning/10 text-warning",
      )}
    >
      {text}
    </Badge>
  );
}

/** A line under a field with an optional action: "Product: …  Use product's". */
export function FieldLine({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span className="min-w-0 break-words">{children}</span>
      {action && onAction && (
        <Button type="button" variant="link" size="sm" className="h-auto min-h-10 p-0 text-xs md:min-h-0" onClick={onAction}>
          {action}
        </Button>
      )}
    </p>
  );
}

/** The marketplace's complaints about one field (marketplace-publish Q6). */
export function FieldIssues({ issues, label }: { issues: ListingIssue[]; label: string }) {
  if (issues.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {issues.map((issue) => (
        <li key={`${issue.code}-${issue.message}`} className="rounded-r-field border-l-2 border-destructive bg-destructive/10 px-2 py-1 text-xs">
          <span className="font-semibold">{PUBLISH.says(label)}</span> {issue.message}
        </li>
      ))}
    </ul>
  );
}

/** One listing field: its name and chip, the control, and the lines under it. */
export function FieldShell({ id, name, chip, children, lines }: { id: string; name: string; chip: ReactNode; children: ReactNode; lines?: ReactNode }) {
  return (
    <div id={id} className="flex scroll-mt-24 flex-col gap-2 border-t border-border py-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{name}</span>
        {chip}
      </div>
      {children}
      {lines}
    </div>
  );
}
