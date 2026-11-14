import { cva } from "class-variance-authority";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** `underline` filters a list; `segmented` switches a whole page between audiences (/business). */
const navVariants = cva("", {
  variants: {
    variant: {
      underline: "no-scrollbar overflow-x-auto border-b border-border",
      segmented: "inline-flex max-w-full rounded-full border border-border bg-muted p-1",
    },
  },
  defaultVariants: { variant: "underline" },
});

const tabVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap text-small transition-colors duration-fast ease-standard",
  {
    variants: {
      variant: {
        underline: "-mb-px min-h-11 border-b-2 px-3",
        segmented: "min-h-10 rounded-full px-4 font-semibold md:px-6",
      },
      active: { true: "", false: "text-muted-foreground hover:text-foreground" },
    },
    compoundVariants: [
      { variant: "underline", active: true, className: "border-primary font-semibold text-foreground" },
      { variant: "underline", active: false, className: "border-transparent font-medium" },
      { variant: "segmented", active: true, className: "bg-background text-foreground shadow-raised" },
    ],
    defaultVariants: { variant: "underline", active: false },
  },
);

export interface PageTab {
  key: string;
  label: string;
  href: string;
  /** What waits under this tab. Hidden at zero: a "0" is noise, not information. */
  count?: number;
}

/**
 * Route tabs: each is a link, so a filter is a URL that can be shared, reloaded and rendered on
 * the server. On a phone the row scrolls sideways rather than wrapping.
 */
export function PageTabs({
  tabs,
  current,
  label,
  variant = "underline",
  className,
}: {
  tabs: readonly PageTab[];
  /** The key of the tab this page is showing. */
  current: string;
  /** What the tabs choose between, for assistive technology: "Order status". */
  label: string;
  variant?: "underline" | "segmented";
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn(navVariants({ variant }), className)}>
      <ul className="flex gap-1">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={tab.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={tabVariants({ variant, active })}
              >
                {tab.label}
                {tab.count ? (
                  <span className={cn("tabular-nums", active ? "text-primary" : "text-muted-foreground")}>{tab.count}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
