import Link from "next/link";
import { Icon } from "@/components/ui/icon";

import { Input } from "@/components/ui/input";
import { ThemePhoto } from "../theme-photo";
import { landingHref, shopHref } from "../section-heading";
import { ThemedCartLink } from "./themed-cart-link";

/** Past this, the name would crowd the search on a phone; the logo carries the shop alone (ux.md Long content). */
export const HEADER_NAME_MAX = 24;

/**
 * A themed shop's header (Q6, D7): its mark and name to the landing page, a search within the
 * shop, and the marketplace's cart with the shared count. No colour of its own: the palette's.
 */
export function ThemedHeader({
  handle,
  name,
  logoUrl,
}: {
  handle: string;
  name: string;
  logoUrl: string | null;
}) {
  const long = name.length > HEADER_NAME_MAX;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-store items-center gap-3 px-gutter">
        <Link
          href={landingHref(handle)}
          prefetch={false}
          aria-label={long ? name : undefined}
          className="flex min-w-0 shrink-0 items-center gap-2"
        >
          <ThemePhoto
            src={logoUrl}
            alt={`${name} logo`}
            sizes="32px"
            initial={name}
            className="size-8 shrink-0 overflow-hidden rounded-full"
          />
          {!long && (
            <span className="truncate font-display text-body font-semibold tracking-headline">{name}</span>
          )}
        </Link>

        <form action={shopHref(handle)} role="search" className="ml-auto flex min-w-0 flex-1 justify-end">
          <label className="flex w-full max-w-xs items-center gap-2 rounded-field border border-border bg-card px-3 py-1.5 text-muted-foreground">
            <Icon name="search" size="sm" />
            <span className="sr-only">Search {name}</span>
            <Input
              type="search"
              name="q"
              placeholder={`Search ${name}`}
              className="h-auto border-0 p-0 text-body text-foreground shadow-none focus-visible:ring-0"
            />
          </label>
        </form>

        <ThemedCartLink />
      </div>
    </header>
  );
}
