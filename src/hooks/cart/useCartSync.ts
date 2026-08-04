"use client";
import { useEffect, useCallback, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useCartStore } from "@/store/cartStore";
import { cartApiClient } from "@/services/cartApiClient";
import { useDebounce } from "@/hooks/core/useDebounce";

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

  const syncCart = useCallback(async () => {
    if (!session?.user?.id) return;
    setIsSyncing(true);
    setSyncError(null);
    justSyncedRef.current = true; // 👈 Mark that sync is happening
    
    try {
      const mergedItems = await cartApiClient.syncCart(items);
      setItems(mergedItems);
      
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
      await cartApiClient.updateCart(items);
    } catch (error) {
      console.error("[useCartSync] Background sync failed:", error);
    }
  }, [session?.user?.id, items]);

  // Sync on login
  useEffect(() => {
    const wasUnauthenticated = prevStatusRef.current !== "authenticated";
    const isNowAuthenticated = status === "authenticated";
    
    if (wasUnauthenticated && isNowAuthenticated && session?.user?.id) {
      syncCart();
    }
    
    prevStatusRef.current = status;
  }, [session?.user?.id, status, syncCart]);

  // Background updates (debounced)
  const debouncedItems = useDebounce(items, 500);
  
  useEffect(() => {
    if (status === "authenticated" && debouncedItems.length > 0) {
      updateCart();
    }
  }, [debouncedItems, status, updateCart]);

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