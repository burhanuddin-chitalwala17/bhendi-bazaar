import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-config";
import { wishlistDAL } from "@/data-access-layer/wishlist.dal";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { WishlistGrid } from "@/components/wishlist/wishlist-grid";

export const metadata = {
  title: "Wishlist",
};

/**
 * The saved-products page, reached from the profile menu.
 *
 * A guest is redirected rather than shown an empty list: there is no guest wishlist,
 * so an empty page here would be indistinguishable from having saved nothing.
 */
export default async function WishlistPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/wishlist");
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
