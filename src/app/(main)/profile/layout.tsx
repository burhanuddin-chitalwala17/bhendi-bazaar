import type { ReactNode } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-shell";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { ContactLauncher } from "@/components/support/contact-launcher";
import { Icon, type IconName } from "@/components/ui/icon";
import { PROFILE_PAGE_COPY } from "./profile-page-copy";
import { optionalActiveSession } from "@/lib/admin-auth";
import { ROUTES } from "@server/shared/routes";

const ROW = "flex min-h-12 items-center gap-3 px-4 py-3 text-small text-foreground transition-colors duration-fast hover:bg-muted";

const LINKS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: ROUTES.orders, label: PROFILE_PAGE_COPY.yourOrders, icon: "orders" },
  { href: ROUTES.wishlist, label: PROFILE_PAGE_COPY.saved, icon: "saved" },
  { href: ROUTES.policies, label: PROFILE_PAGE_COPY.policies, icon: "returns" },
];

/** Signed in only: the navbar's profile menu, which carries these, is hidden on a phone. */
const SIGNED_IN_LINKS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: ROUTES.org.root, label: PROFILE_PAGE_COPY.yourShop, icon: "organisation" },
];

/** The Account tab: where Contact us, Your shop and Sign out live on a phone (design-system Q21), above the profile itself. */
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const session = await optionalActiveSession({ onBlocked: "allow" });
  const links = session ? [...LINKS, ...SIGNED_IN_LINKS] : LINKS;

  return (
    <div className="space-y-6">
      <PageHeader title={PROFILE_PAGE_COPY.title} description={PROFILE_PAGE_COPY.description} />
      <nav aria-label={PROFILE_PAGE_COPY.nav} className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
        {links.map((link) => (
          <Link key={link.href} href={link.href} prefetch={false} className={ROW}>
            <Icon name={link.icon} size="md" tone="muted" />
            <span className="flex-1">{link.label}</span>
            <Icon name="next" size="sm" tone="muted" />
          </Link>
        ))}
        <ContactLauncher className={`${ROW} h-auto w-full justify-start rounded-none font-normal`}>
          <Icon name="help" size="md" tone="muted" />
          <span className="flex-1 text-left">{PROFILE_PAGE_COPY.contactUs}</span>
          <Icon name="next" size="sm" tone="muted" />
        </ContactLauncher>
      </nav>
      {children}
      {session && (
        <div className="flex justify-center border-t border-border pt-4">
          <SignOutButton />
        </div>
      )}
    </div>
  );
}
