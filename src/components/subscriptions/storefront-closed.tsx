import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@server/shared/routes";
import { STOREFRONT_LOCKED_COPY } from "./subscriptions-copy";

/**
 * A locked storefront, to anyone but the shop's team (subscriptions/feature-access ux.md "Anyone
 * else", Q6, Q8): the shop's name and logo only, and the way to its products on Bhendi Bazaar.
 * One centred column at every width.
 */
export function StorefrontClosed({ shop }: { shop: { name: string; logoUrl: string | null } }) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-section text-center">
      {shop.logoUrl ? (
        <div className="relative size-16 overflow-hidden rounded-full bg-muted">
          <Image src={shop.logoUrl} alt="" fill sizes="64px" className="object-cover" />
        </div>
      ) : (
        <div aria-hidden className="flex size-16 items-center justify-center rounded-full bg-muted font-heading text-2xl font-bold">
          {shop.name.charAt(0).toUpperCase()}
        </div>
      )}
      <h1 className="text-balance font-heading text-headline font-semibold">{STOREFRONT_LOCKED_COPY.closedTitle(shop.name)}</h1>
      <p className="text-small text-muted-foreground">{STOREFRONT_LOCKED_COPY.closedBody}</p>
      <Button asChild size="lg" className="rounded-full">
        <Link href={ROUTES.shopAll} prefetch={false}>{STOREFRONT_LOCKED_COPY.browse}</Link>
      </Button>
    </section>
  );
}
