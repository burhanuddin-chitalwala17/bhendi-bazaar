"use client";
import { useEffect, useCallback, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useCartStore } from "@/store/cartStore";
import { cartApiClient } from "@/services/cartApiClient";
import { useDebounce } from "@/hooks/core/useDebounce";
import { ApiError } from "@/lib/api-error";
import { toast } from "sonner";

const LAST_CLEANUP_KEY = "cart-last-cleanup";
const CLEANUP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

export function useCartSync() {
  const { data: session, status } = useSession();
  const setItems = useCartStore((state) => state.setItems);
  const items = useCartStore((state) => state.items);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  // Track if we just completed a login sync
  const justSyncedRef = useRef(false);
  const prevStatusRef = useRef(status);
  // The server-cart version our next write is based on. 0 = no basis yet, so the
  // first write after a failed sync is last-write-wins once rather than failing.
  const versionRef = useRef(0);
  // Serialized items as of the last server write (or the mount snapshot). A write
  // only goes out when the basket actually differs — the persisted cart rehydrating
  // on page load is not a change, and neither is the debounce settling on a value
  // that was already written.
  const lastWrittenRef = useRef<string | null>(null);

  const syncCart = useCallback(async () => {
    if (!session?.user?.id) return;
    setIsSyncing(true);
    setSyncError(null);
    justSyncedRef.current = true; // 👈 Mark that sync is happening
    
    try {
      const merged = await cartApiClient.syncCart(items);
      setItems(merged.items);
      versionRef.current = merged.version;
      lastWrittenRef.current = JSON.stringify(merged.items);
      
      // Cleanup old anonymous cart data after successful sync
      cleanupOldCartData();
      
      // Keep the flag for a bit to prevent race condition
      setTimeout(() => {
        justSyncedRef.current = false;
      }, 1000); // 1 second guard
    } catch (error) {
      console.error("[useCartSync] syncCart failed:", error);
      setSyncError("Failed to sync cart");
      justSyncedRef.current = false;
    } finally {
      setIsSyncing(false);
    }
  }, [session?.user?.id, setItems, items]);

  const updateCart = useCallback(async () => {
    if (!session?.user?.id) return;
    
    // 👈 Skip if we just synced on login
    if (justSyncedRef.current) {
      console.log("[Cart] Skipping background update - just synced");
      return;
    }

    try {
      const { version } = await cartApiClient.updateCart(
        items,
        versionRef.current || undefined
      );
      versionRef.current = version;
      lastWrittenRef.current = JSON.stringify(items);
    } catch (error) {
      // 409: another tab or device wrote first. Re-sync merges both carts instead
      // of either overwriting the other (inventory-reservation R7).
      if (error instanceof ApiError && error.status === 409) {
        toast.info("Your cart was updated in another tab — merging.");
        await syncCart();
        return;
      }
      console.error("[useCartSync] Background sync failed:", error);
    }
  }, [session?.user?.id, items, syncCart]);

  // Sync on login
  useEffect(() => {
    const wasUnauthenticated = prevStatusRef.current !== "authenticated";
    const isNowAuthenticated = status === "authenticated";
    
    if (wasUnauthenticated && isNowAuthenticated && session?.user?.id) {
      syncCart();
    }
    
    prevStatusRef.current = status;
  }, [session?.user?.id, status, syncCart]);

  // Background updates (debounced). updateCart is reached through a ref so the
  // effect fires only when the debounced value settles — with updateCart itself
  // in the deps, its identity change on the raw items change fired the effect
  // immediately AND again after the debounce: two writes per cart mutation.
  const updateCartRef = useRef(updateCart);
  updateCartRef.current = updateCart;
  const debouncedItems = useDebounce(items, 500);

  useEffect(() => {
    if (status !== "authenticated" || debouncedItems.length === 0) return;
    const snapshot = JSON.stringify(debouncedItems);
    if (lastWrittenRef.current === null) {
      // First settle after mount: the persisted cart rehydrating. Record it,
      // don't write it — the server cart is not stale just because a page loaded.
      lastWrittenRef.current = snapshot;
      return;
    }
    if (snapshot === lastWrittenRef.current) return;
    updateCartRef.current();
  }, [debouncedItems, status]);

  return {
    isSyncing,
    syncError,
  };
}

/**
 * Clean up old anonymous cart data from localStorage
 * Runs periodically after successful login sync
 */
function cleanupOldCartData() {
  try {
    const lastCleanup = localStorage.getItem(LAST_CLEANUP_KEY);
    const now = Date.now();

    // Only cleanup once per week to avoid excessive operations
    if (lastCleanup && now - parseInt(lastCleanup) < CLEANUP_INTERVAL) {
      return;
    }

    // Update last cleanup timestamp
    localStorage.setItem(LAST_CLEANUP_KEY, now.toString());

    console.log("[Cart] Periodic cleanup completed");
  } catch (error) {
    console.warn("[Cart] Failed to cleanup old cart data:", error);
  }
}