"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/context/WishlistContext";
import { cn } from "@/lib/utils";

/**
 * The heart. A client leaf inside otherwise-server product surfaces, the same shape
 * ShareButton takes on the product page.
 *
 * It sits inside the card's `<Link>`, so the click has to be stopped from navigating —
 * hearting a tile must save it, not open it.
 */
export function WishlistButton({
  productId,
  showLabel = false,
  className,
}: {
  productId: string;
  showLabel?: boolean;
  className?: string;
}) {
  const { isSaved, isPending, toggle } = useWishlist();
  const saved = isSaved(productId);
  const pending = isPending(productId);

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={saved}
      disabled={pending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggle(productId);
      }}
      className={cn(
        // size-9 is the floor for a tap target (ADR-0015) and all a 105px tile can
        // spare; the icon inside carries the visual size instead.
        "inline-flex size-9 items-center justify-center rounded-full transition-colors",
        "disabled:opacity-60",
        showLabel && "w-auto gap-2 px-3 text-2xs font-medium",
        saved ? "text-favorite" : "text-muted-foreground",
        className
      )}
    >
      <Heart className={cn("size-4", saved && "fill-favorite")} />
      {showLabel && <span>{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}
