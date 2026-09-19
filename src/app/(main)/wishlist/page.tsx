import { getServerSession } from "next-auth";
import { Heart } from "lucide-react";

import { authOptions } from "@/lib/auth-config";
import { wishlistDAL } from "@/data-access-layer/wishlist.dal";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { WishlistGrid } from "@/components/wishlist/wishlist-grid";
import { SignInButton } from "@/components/auth/sign-in-button";

export const metadata = {
  title: "Wishlist",
};

/**
 * The saved-products page, reached from the profile menu.
 *
 * A guest gets a sign-in prompt rather than an empty list: there is no guest wishlist,
 * so an empty page here would be indistinguishable from having saved nothing. Signing
 * in from the sheet refreshes this page in place (seamless-sign-in D9).
 */
export default async function WishlistPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <PageShell width="wide">
        <PageHeader title="Wishlist" />
        <div className="flex flex-col items-center gap-3 rounded-card border border-border/70 bg-card px-4 py-10 text-center">
          <Heart className="size-6 text-muted-foreground" />
          <p className="text-sm font-semibold">Sign in to see your wishlist</p>
          <p className="max-w-sm text-2xs text-muted-foreground">
            Products you save with the heart are kept on your account, on every
            device.
          </p>
          <SignInButton className="h-10 rounded-full px-6 text-xs font-semibold uppercase tracking-eyebrow" />
        </div>
      </PageShell>
    );
  }

  const items = await wishlistDAL.getWishlist();

  return (
    <PageShell width="wide">
      <PageHeader
        title="Wishlist"
        description={
          items.length > 0
            ? `${items.length} saved ${items.length === 1 ? "product" : "products"}`
            : undefined
        }
      />
      <WishlistGrid items={items} />
    </PageShell>
  );
}
