import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { PageHelp } from "@/components/layout/page-help";
import type { PortalNavKey } from "@/components/layout/portal-nav";
import { cn } from "@/lib/utils";

/** Named for the page's job, not its pixel width, so the widths can move together (ADR-0022). */
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

export interface PageHeaderProps {
  /** The page's one h1. */
  title: ReactNode;
  description?: ReactNode;
  /** A short uppercase run above the title ("Order"). */
  eyebrow?: ReactNode;
  /** The parent page, named: "Products", not "Back". */
  back?: { href: string; label: string };
  /** On a phone the caller may move the primary action into `ActionBar` instead. */
  actions?: ReactNode;
  /** A portal navigation key: renders "?", which says what the page is for (onboarding D9). */
  help?: PortalNavKey;
  className?: string;
}

/** The one page title: every screen has exactly one, so the outline and the look agree. */
export function PageHeader({ title, description, eyebrow, back, actions, help, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-2", className)}>
      {back && (
        <Link
          href={back.href}
          prefetch={false}
          className="-ml-1 inline-flex min-h-10 items-center gap-1 self-start rounded-field px-1 text-small font-medium text-muted-foreground hover:text-foreground"
        >
          <Icon name="back" size="sm" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4">
        <div className="min-w-0 space-y-1">
          {eyebrow && <p className="text-label uppercase text-muted-foreground">{eyebrow}</p>}
          <div className="flex items-center gap-1">
            <h1 className="font-heading text-headline font-semibold text-foreground">{title}</h1>
            {help && <PageHelp help={help} />}
          </div>
          {description && <p className="text-small text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
