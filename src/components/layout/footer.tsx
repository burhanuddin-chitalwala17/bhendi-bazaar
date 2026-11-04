import Link from "next/link";

import { BrandLogo } from "@/components/layout/brand-logo";
import { cn } from "@/lib/utils";
import { ContactLauncher } from "@/components/support/contact-launcher";

export const POLICY_LINKS = [
  { href: "/policies#shipping", label: "Shipping" },
  { href: "/policies#returns", label: "Returns & refunds" },
  { href: "/policies#privacy", label: "Privacy" },
  { href: "/policies#terms", label: "Terms" },
  { href: "/policies#grievance", label: "Grievances" },
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
          <Link href="/" prefetch={false} className="inline-flex">
            <BrandLogo size="sm" />
          </Link>
          <p className="max-w-xs text-small text-muted-foreground">
            The shops of Mumbai&apos;s Bhendi Bazaar, delivered across India.
          </p>
        </div>

        <nav aria-label="Shop" className="flex flex-col">
          <p className={HEADING}>Shop</p>
          {shopLinks.map((link) => (
            <Link key={link.href} href={link.href} prefetch={false} className={LINK}>
              {link.label}
            </Link>
          ))}
          <Link href="/store" prefetch={false} className={LINK}>All shops</Link>
          <Link href="/offers" prefetch={false} className={LINK}>Offers</Link>
          <Link href="/sell" prefetch={false} className={LINK}>Sell on Bhendi Bazaar</Link>
        </nav>

        <nav aria-label="Help" className="flex flex-col">
          <p className={HEADING}>Help</p>
          <ContactLauncher className="h-auto min-h-10 justify-start px-0 text-small font-normal text-muted-foreground hover:bg-transparent hover:text-foreground md:min-h-0">
            Contact us
          </ContactLauncher>
          <Link href="/orders" prefetch={false} className={LINK}>Track an order</Link>
          <Link href="/policies#returns" prefetch={false} className={LINK}>Returns</Link>
          <Link href="/policies#cancellation" prefetch={false} className={LINK}>Cancellations</Link>
        </nav>

        <nav aria-label="Store policies" className="col-span-2 flex flex-col md:col-span-1">
          <p className={HEADING}>Policies</p>
          {POLICY_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} prefetch={false} className={LINK}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mx-auto max-w-page px-4 pb-6 text-caption text-muted-foreground sm:px-6 lg:px-8">
        © {year} Bhendi Bazaar · Crafted with niyyah in Mumbai&apos;s old quarter.
      </p>
    </footer>
  );
}
