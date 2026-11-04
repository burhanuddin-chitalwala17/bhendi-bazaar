import { optionalActiveSession } from "@/lib/admin-auth";

import { wishlistDAL } from "@/data-access-layer/wishlist.dal";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { WishlistGrid } from "@/components/wishlist/wishlist-grid";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Icon } from "@/components/ui/icon";
import { WISHLIST_COPY } from "@/components/wishlist/wishlist-copy";

export const metadata = {
  title: WISHLIST_COPY.title,
};

/** Saved products (the Saved tab). A guest is asked to sign in: there is no guest list, and empty would mislead (seamless-sign-in D9). */
export default async function WishlistPage() {
  const session = await optionalActiveSession({ onBlocked: "allow" });
  if (!session?.user?.id) {
    return (
      <PageShell width="wide">
        <PageHeader title={WISHLIST_COPY.title} />
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-card px-4 py-10 text-center">
          <Icon name="saved" size="xl" tone="muted" />
          <h2 className="text-title font-semibold">{WISHLIST_COPY.signInTitle}</h2>
          <p className="max-w-sm text-small text-muted-foreground">{WISHLIST_COPY.signInBody}</p>
          <SignInButton className="h-10 rounded-full px-6" />
        </div>
      </PageShell>
    );
  }

  const items = await wishlistDAL.getWishlist();

  return (
    <PageShell width="wide">
      <PageHeader
        title={WISHLIST_COPY.title}
        description={items.length > 0 ? WISHLIST_COPY.count(items.length) : undefined}
      />
      <WishlistGrid items={items} />
    </PageShell>
  );
}
