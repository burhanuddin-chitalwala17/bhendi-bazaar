import Link from "next/link";

import { BrandLogo } from "@/components/layout/brand-logo";
import { cn } from "@/lib/utils";
import { ContactLauncher } from "@/components/support/contact-launcher";
import { ROUTES } from "@server/shared/routes";
import { FOOTER_COPY } from "./layout-copy";

export const POLICY_LINKS = [
  { href: ROUTES.policy("shipping"), label: FOOTER_COPY.shipping },
  { href: ROUTES.policy("returns"), label: FOOTER_COPY.returnsRefunds },
  { href: ROUTES.policy("privacy"), label: FOOTER_COPY.privacy },
  { href: ROUTES.policy("terms"), label: FOOTER_COPY.terms },
  { href: ROUTES.policy("grievance"), label: FOOTER_COPY.grievances },
];

const LINK = "inline-flex min-h-10 items-center text-small text-muted-foreground transition-colors duration-fast hover:text-foreground md:min-h-0";
const HEADING = "text-label uppercase text-foreground";

/**
 * The store's footer, on every form factor: returns, grievance and contact are compliance
 * links a phone shopper must reach too, so it sits above the tab bar rather than hiding.
 */
export function Footer({
  shopLinks = [],
  className,
}: {
  shopLinks?: Array<{ href: string; label: string }>;
  /** Layout only: room for a tab bar docked below it. */
  className?: string;
}) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn("border-t border-border bg-card", className)}>
      <div className="mx-auto grid max-w-page grid-cols-2 gap-x-4 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="col-span-2 space-y-3 md:col-span-1">
          <Link href={ROUTES.home} prefetch={false} className="inline-flex">
            <BrandLogo size="sm" />
          </Link>
          <p className="max-w-xs text-small text-muted-foreground">{FOOTER_COPY.tagline}</p>
        </div>

        <nav aria-label={FOOTER_COPY.shopNav} className="flex flex-col">
          <p className={HEADING}>{FOOTER_COPY.shopHeading}</p>
          {shopLinks.map((link) => (
            <Link key={link.href} href={link.href} prefetch={false} className={LINK}>
              {link.label}
            </Link>
          ))}
          <Link href={ROUTES.stores} prefetch={false} className={LINK}>{FOOTER_COPY.allShops}</Link>
          <Link href={ROUTES.offers} prefetch={false} className={LINK}>{FOOTER_COPY.offers}</Link>
          <Link href={ROUTES.business} prefetch={false} className={LINK}>{FOOTER_COPY.sell}</Link>
        </nav>

        <nav aria-label={FOOTER_COPY.helpNav} className="flex flex-col">
          <p className={HEADING}>{FOOTER_COPY.helpHeading}</p>
          <ContactLauncher className="h-auto min-h-10 justify-start px-0 text-small font-normal text-muted-foreground hover:bg-transparent hover:text-foreground md:min-h-0">
            {FOOTER_COPY.contactUs}
          </ContactLauncher>
          <Link href={ROUTES.orders} prefetch={false} className={LINK}>{FOOTER_COPY.trackOrder}</Link>
          <Link href={ROUTES.policy("returns")} prefetch={false} className={LINK}>{FOOTER_COPY.returns}</Link>
          <Link href={ROUTES.policy("cancellation")} prefetch={false} className={LINK}>{FOOTER_COPY.cancellations}</Link>
        </nav>

        <nav aria-label={FOOTER_COPY.policiesNav} className="col-span-2 flex flex-col md:col-span-1">
          <p className={HEADING}>{FOOTER_COPY.policiesHeading}</p>
          {POLICY_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} prefetch={false} className={LINK}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mx-auto max-w-page px-4 pb-6 text-caption text-muted-foreground sm:px-6 lg:px-8">
        {FOOTER_COPY.legal(year)}
      </p>
    </footer>
  );
}
