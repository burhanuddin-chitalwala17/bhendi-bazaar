"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

import { Button } from "@/components/ui/button";
import { SHOP_DETAILS_COPY } from "./shop-details-copy";
import type { SectionProblem } from "./useShopDetailsSection";
import { useSaveAll } from "./useSaveBar";

/** The eye and the line saying where a field shows (org-profile D2, A2). */
export function SeenBy({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-start gap-1">
      <Icon name="show" size="xs" className="mt-0.5" />
      <span>{children}</span>
    </span>
  );
}

/** One section's form and banners. Saving is the page's one bar (Q30); Enter or "Try again" runs it. */
export function SectionForm({
  id,
  title,
  problem,
  formError,
  onLoadLatest,
  children,
}: {
  id: string;
  title?: string;
  problem: SectionProblem;
  /** A failure with no banner of its own and no field to sit on: shown here, never silent (ADR-0013). */
  formError: string | null;
  onLoadLatest: () => void;
  children: ReactNode;
}) {
  const saveAll = useSaveAll();
  return (
    <form id={id} onSubmit={saveAll} noValidate className="scroll-mt-20 space-y-4">
      {title && <h3 className="font-heading text-base font-semibold">{title}</h3>}
      {problem?.kind === "retry" && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{SHOP_DETAILS_COPY.retry}</span>
          <Button type="submit" variant="outline" size="sm">
            {SHOP_DETAILS_COPY.tryAgain}
          </Button>
        </div>
      )}
      {problem?.kind === "stale" && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <span>{problem.message}</span>
          <Button type="button" variant="outline" size="sm" onClick={onLoadLatest}>
            {SHOP_DETAILS_COPY.loadLatest}
          </Button>
        </div>
      )}
      {!problem && formError && (
        <p role="alert" className="rounded-card border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}
      {children}
    </form>
  );
}

/** An optional row, collapsed until opened, saying the line it adds (R3, ux Partial). */
export function OptionalRow({
  id,
  title,
  adds,
  open,
  children,
}: {
  id: string;
  title: string;
  adds: string;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <details id={`${id}-row`} open={open} className="group rounded-card border border-border bg-card">
      {/* min-h-11 keeps the tap target past 40px on a phone (ADR-0015). */}
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-1 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">· {adds}</span>
      </summary>
      <div className="border-t border-border px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}
