import Image from "next/image";
import Link from "next/link";

import { APP_NAME, LOGO } from "@/lib/config";
import { POLICY_LINKS } from "@/components/layout/footer";
import { ContactLauncher } from "@/components/support/contact-launcher";
import { dealsHref, landingHref, shopHref, visitLabel } from "../section-heading";
import { THEMED_COPY } from "../themed-copy";

/**
 * A themed shop's footer (Q6, own-store Q22): the shop's own links, then the platform band —
 * the platform's mark, "Sold on Bhendi Bazaar", its contact and its policies. Buyers reach the
 * shop through the platform's contact, never the shop's phone (Q22).
 */
export function ThemedFooter({ handle, name }: { handle: string; name: string }) {
  return (
    <footer className="border-t border-border bg-background pb-tabbar md:pb-0">
      <nav aria-label={name} className="mx-auto flex max-w-store flex-wrap gap-x-6 gap-y-2 px-gutter py-6 font-label text-tag uppercase tracking-tag">
        <Link href={landingHref(handle)} prefetch={false}>{visitLabel(name)}</Link>
        <Link href={shopHref(handle)} prefetch={false}>{THEMED_COPY.footer.shop}</Link>
        <Link href={dealsHref(handle)} prefetch={false}>{THEMED_COPY.footer.deals}</Link>
      </nav>

      <div data-platform-band className="border-t border-border bg-muted text-muted-foreground">
        <div className="mx-auto flex max-w-store flex-col gap-3 px-gutter py-6 text-tag md:flex-row md:items-center md:justify-between">
          <Link href="/" prefetch={false} className="flex items-center gap-2 text-foreground">
            <Image src={LOGO.ICON} alt="" width={24} height={24} className="size-6" />
            <span>Sold on {APP_NAME}</span>
          </Link>
          <nav aria-label={`${APP_NAME} policies`} className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ContactLauncher className="h-auto p-0 text-tag text-muted-foreground underline-offset-4 hover:underline">
              {THEMED_COPY.footer.contactUs}
            </ContactLauncher>
            {POLICY_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} prefetch={false} className="underline-offset-4 hover:underline">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
