"use client";

import { useState } from "react";
import { useWishlist } from "@/context/WishlistContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { WISHLIST_BUTTON_LABEL_COPY } from "@/components/wishlist/wishlist-copy";

/** The heart: a client leaf on server product surfaces. It stops the click so saving never opens the product. */
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
  // Pops once a save has landed; a failed write reverts `saved`, so it never pops for nothing.
  const [popped, setPopped] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      shape="icon"
      size="lg"
      aria-label={saved ? WISHLIST_BUTTON_LABEL_COPY.remove : WISHLIST_BUTTON_LABEL_COPY.add}
      aria-pressed={saved}
      disabled={pending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const saving = !saved;
        setPopped(false);
        void toggle(productId).then(() => setPopped(saving));
      }}
      className={cn(
        "rounded-full disabled:opacity-60",
        showLabel && "w-auto gap-2 px-3 text-small font-medium",
        saved ? "text-favorite" : "text-muted-foreground",
        className,
      )}
    >
      <Icon name="saved" size={showLabel ? "md" : "sm"} filled={saved} motion={popped && saved} />
      {showLabel && <span>{saved ? "Saved" : "Save"}</span>}
    </Button>
  );
}
