import type { ReactNode } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-shell";
import { ContactLauncher } from "@/components/support/contact-launcher";
import { Icon, type IconName } from "@/components/ui/icon";

const ROW = "flex min-h-12 items-center gap-3 px-4 py-3 text-small text-foreground transition-colors duration-fast hover:bg-muted";

const LINKS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/orders", label: "Your orders", icon: "orders" },
  { href: "/wishlist", label: "Saved", icon: "saved" },
  { href: "/policies", label: "Returns, shipping and grievances", icon: "returns" },
];

/** The Account tab: where Contact us lives on a phone (design-system Q21), above the profile itself. */
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Account" description="Your details, addresses and orders." />
      <nav aria-label="Account" className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} prefetch={false} className={ROW}>
            <Icon name={link.icon} size="md" tone="muted" />
            <span className="flex-1">{link.label}</span>
            <Icon name="next" size="sm" tone="muted" />
          </Link>
        ))}
        <ContactLauncher className={`${ROW} h-auto w-full justify-start rounded-none font-normal`}>
          <Icon name="help" size="md" tone="muted" />
          <span className="flex-1 text-left">Contact us</span>
          <Icon name="next" size="sm" tone="muted" />
        </ContactLauncher>
      </nav>
      {children}
    </div>
  );
}
