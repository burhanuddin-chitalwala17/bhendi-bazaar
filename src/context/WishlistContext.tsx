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
import { useAuthSheet } from "@/context/AuthSheetContext";
import { wishlistApiClient } from "@/components/wishlist/wishlistApiClient";

interface WishlistContextValue {
  isSaved: (productId: string) => boolean;
  /** True while this product's save or removal is in flight. */
  isPending: (productId: string) => boolean;
  /**
   * Save if hollow, forget if filled. A signed-out caller is offered the sign-in sheet.
   *
   * The only thing that removes a saved product — nothing else in the app clears a
   * wish, so a heart the buyer left filled stays filled.
   */
  toggle: (productId: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(
  undefined,
);

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
  const { open: openAuthSheet } = useAuthSheet();
  const [saved, setSaved] = useState<Set<string>>(
    () => new Set(initialProductIds),
  );
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
      // Only a settled "guest" gets the sheet: while the session is loading, asking
      // would tell someone who *is* signed in to sign in, so the route's 401 decides.
      // The save finishes after sign-in as a save, never this toggle (seamless-sign-in D6, D8).
      if (status === "guest") {
        openAuthSheet({
          reason: "Sign in to save this",
          intent: { kind: "wishlist.save", productId },
        });
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
        if (wasSaved) await wishlistApiClient.remove(productId);
        else await wishlistApiClient.save(productId);

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
            : "Could not update your wishlist. Please try again.",
        );
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(productId);
          return next;
        });
      }
    },
    [saved, status, openAuthSheet],
  );

  const value: WishlistContextValue = {
    isSaved: useCallback((productId: string) => saved.has(productId), [saved]),
    isPending: useCallback(
      (productId: string) => pending.has(productId),
      [pending],
    ),
    toggle,
  };

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
