"use client";

import type { ReactNode } from "react";

/** Label, control and message for one auth form field. */
export function AuthField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-eyebrow">
        {label}
      </label>
      {children}
      {error && <p className="text-2xs text-destructive">{error}</p>}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="h-px flex-1 bg-border/70" />
      <span className="text-2xs uppercase tracking-eyebrow text-muted-foreground">or</span>
      <span className="h-px flex-1 bg-border/70" />
    </div>
  );
}

export const PRIMARY_BUTTON =
  "mt-2 h-10 w-full rounded-full text-xs font-semibold uppercase tracking-eyebrow";
