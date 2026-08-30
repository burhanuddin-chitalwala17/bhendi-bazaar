import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one page container and the one page header. Before these, page width was
 * eight different `mx-auto max-w-*` literals and the portal title was eight verbatim
 * copies of the same `<h1>` — so "make pages wider" or "restyle the page title" was a
 * twenty-six-site edit for what is one decision. (ADR-0022)
 */

/** Named for the page's job, not its pixel width, so the widths can move together. */
const WIDTHS = {
  narrow: "max-w-3xl", // a single form column
  form: "max-w-4xl", // a form with side-by-side fields
  default: "max-w-5xl", // a detail page
  wide: "max-w-6xl", // a listing or dashboard
} as const;

export function PageShell({
  width = "default",
  className,
  children,
}: {
  width?: keyof typeof WIDTHS;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full space-y-6", WIDTHS[width], className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  back,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Renders the back affordance to the left of the title. */
  back?: { href: string; label?: string };
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {back && (
          <Button asChild variant="ghost" size="icon">
            <Link href={back.href} aria-label={back.label ?? "Go back"}>
              <ArrowLeft />
            </Link>
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      )}
    </div>
  );
}
