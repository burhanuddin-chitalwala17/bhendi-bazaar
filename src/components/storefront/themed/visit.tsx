import { ContactLauncher } from "@/components/support/contact-launcher";
import { cn } from "@/lib/utils";
import type { SectionVariant } from "@server/catalog/storefront-themes";
import { dispatchWithin, returnsText, type VisitSlice } from "./page-data";
import { SectionHeading } from "./section-heading";
import { THEMED_COPY } from "./themed-copy";

/**
 * Visit & contact (Q22): area, today's hours, the shop's promises, and "Contact us", which
 * reaches the platform. A buyer never sees the shop's phone or WhatsApp.
 */
const isLine = (line: string | false | null | undefined): line is string => Boolean(line);

export function ThemedVisit({
  variant,
  area,
  hoursToday,
  dispatchDays,
  returns,
}: VisitSlice & { variant: SectionVariant<"visit"> }) {
  const lines = [
    area,
    hoursToday && `Open today ${hoursToday}`,
    dispatchDays != null && `Dispatch ${dispatchWithin(dispatchDays)}`,
    returns && returnsText(returns.preset),
  ].filter(isLine);

  return (
    <section className="mx-auto max-w-store px-gutter py-section">
      <div className={cn("space-y-4", variant === "card" && "rounded-card bg-card p-6 shadow-tile")}>
        <SectionHeading title={THEMED_COPY.sections.visit} />
        <ul className={cn("space-y-1 text-body", variant === "inline" && "md:flex md:gap-6 md:space-y-0")}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {returns?.note && (
          <p className="whitespace-pre-line break-words text-tag text-muted-foreground">{returns.note}</p>
        )}
        <ContactLauncher className="min-h-11 rounded-field border border-border px-6">{THEMED_COPY.sections.contactUs}</ContactLauncher>
      </div>
    </section>
  );
}
