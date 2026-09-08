"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { readApiError } from "@/lib/api-error";

interface WishlistContextValue {
  isSaved: (productId: string) => boolean;
  /** True while this product's save or removal is in flight. */
  isPending: (productId: string) => boolean;
  /** Save if hollow, forget if filled. Signed-out callers get the sign-in toast. */
  toggle: (productId: string) => Promise<void>;
  /**
   * Note that this product was carted after arriving from the wishlist, so a later
   * confirmed payment can clear the wish. Fire-and-forget.
   */
  markCartedFromWishlist: (productId: string) => void;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

/**
 * The saved-product set, shared by every heart on the page.
 *
 * `initialProductIds` is read on the server by the layout, so hearts are painted in
 * the first render — a fetch on mount would flash every heart hollow and re-fill it,
 * and it is a round trip for data the server already had.
 *
 * State is shared rather than per-button because one product can appear more than once
 * on a page (a grid tile and the "similar products" rail below it), and two hearts for
 * one product must not disagree.
 */
export function WishlistProvider({
  initialProductIds,
  children,
}: {
  initialProductIds: string[];
  children: ReactNode;
}) {
  const { status } = useAuth();
  const [saved, setSaved] = useState<Set<string>>(() => new Set(initialProductIds));
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  // The server is the authority on what is saved; adopt its set whenever a navigation
  // or a `router.refresh()` brings a new one. Signing out empties it — the next user
  // of this browser must not inherit the last one's hearts.
  useEffect(() => {
    if (status === "guest") {
      setSaved(new Set());
      return;
    }
    setSaved(new Set(initialProductIds));
    // A new array identity with the same ids is the same set, so compare by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductIds.join(","), status]);

  const toggle = useCallback(
    async (productId: string) => {
      // Only a settled "guest" earns the toast. While the session is still loading we
      // cannot tell a signed-in user from a visitor, and refusing on the guess would
      // tell someone who *is* signed in to sign in — so let the write go and let the
      // route's own 401 answer, which carries this same sentence.
      if (status === "guest") {
        toast("Sign in to add to wishlist");
        return;
      }

      const wasSaved = saved.has(productId);

      // Optimistic: the heart fills under the finger, and reverts only if the write
      // actually failed. Waiting for the round trip makes every tap feel broken.
      setSaved((current) => {
        const next = new Set(current);
        if (wasSaved) next.delete(productId);
        else next.add(productId);
        return next;
      });
      setPending((current) => new Set(current).add(productId));

      try {
        const response = wasSaved
          ? await fetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`, {
              method: "DELETE",
              credentials: "include",
            })
          : await fetch("/api/wishlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ productId }),
            });

        if (!response.ok) throw await readApiError(response);

        // After the write, not alongside the optimistic fill: a toast that says
        // "Added" and is followed by an error toast when the write fails has told
        // the user two contradictory things about the same tap.
        if (!wasSaved) toast.success("Added to wishlist");
      } catch (error) {
        setSaved((current) => {
          const next = new Set(current);
          if (wasSaved) next.add(productId);
          else next.delete(productId);
          return next;
        });
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not update your wishlist. Please try again."
        );
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(productId);
          return next;
        });
      }
    },
    [saved, status]
  );

  // Deliberately not awaited and never surfaced: this records where the buyer came
  // from, and a buyer whose item reached the cart must not see an error because a
  // breadcrumb did not. Guests have no wishlist row to mark.
  const markCartedFromWishlist = useCallback(
    (productId: string) => {
      if (status !== "authenticated" || !saved.has(productId)) return;
      void fetch("/api/wishlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId }),
      }).catch(() => {});
    },
    [saved, status]
  );

  const value: WishlistContextValue = {
    isSaved: useCallback((productId: string) => saved.has(productId), [saved]),
    isPending: useCallback((productId: string) => pending.has(productId), [pending]),
    toggle,
    markCartedFromWishlist,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
