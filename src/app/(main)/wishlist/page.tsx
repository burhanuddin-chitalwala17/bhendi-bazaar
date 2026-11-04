import { optionalActiveSession } from "@/lib/admin-auth";

import { wishlistDAL } from "@/data-access-layer/wishlist.dal";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { WishlistGrid } from "@/components/wishlist/wishlist-grid";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Icon } from "@/components/ui/icon";

export const metadata = {
  title: "Saved",
};

/** Saved products (the Saved tab). A guest is asked to sign in: there is no guest list, and empty would mislead (seamless-sign-in D9). */
export default async function WishlistPage() {
  const session = await optionalActiveSession({ onBlocked: "allow" });
  if (!session?.user?.id) {
    return (
      <PageShell width="wide">
        <PageHeader title="Saved" />
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-card px-4 py-10 text-center">
          <Icon name="saved" size="xl" tone="muted" />
          <h2 className="text-title font-semibold">Sign in to see what you saved</h2>
          <p className="max-w-sm text-small text-muted-foreground">
            Pieces you save with the heart are kept on your account, on every device.
          </p>
          <SignInButton className="h-10 rounded-full px-6" />
        </div>
      </PageShell>
    );
  }

  const items = await wishlistDAL.getWishlist();

  return (
    <PageShell width="wide">
      <PageHeader
        title="Saved"
        description={
          items.length > 0
            ? `${items.length} saved ${items.length === 1 ? "piece" : "pieces"}`
            : undefined
        }
      />
      <WishlistGrid items={items} />
    </PageShell>
  );
}
