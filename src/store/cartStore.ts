import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Cart, CartItem } from "@/domain/cart";

type CartStoreState = Cart & {
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  /** Drop the lines an order bought, by (product, size, colour) — nothing else. */
  removeLines: (lines: Array<Pick<CartItem, "productId" | "size" | "color">>) => void;
  setItems: (items: CartItem[]) => void;
  /**
   * The saved cart has been read from this device. False through the server render and the
   * first client render, so both show the same empty cart and React does not mismatch; the
   * saved lines arrive one render later (docs/GTM-READINESS.md B9).
   */
  hasHydrated: boolean;
};

// Missing and empty variants are the same line, as on the server (server/cart/cart.merge.ts).
const variantKey = (line: Pick<CartItem, "productId" | "size" | "color">) =>
  `${line.productId}::${line.size || ""}::${line.color || ""}`;

function computeTotals(items: CartItem[]) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const discount = items.reduce(
    (sum, item) =>
      sum +
      (item.salePrice ? (item.price - item.salePrice) * item.quantity : 0),
    0
  );
  return { subtotal, discount, shipping: 0, total: subtotal - discount };
}

/**
 * Validate and clean cart item
 * Returns null if item is invalid
 */
function validateCartItem(item: CartItem): CartItem | null {
  try {
    // Check all required fields exist and are valid
    if (
      !item.id ||
      typeof item.id !== "string" ||
      !item.productId ||
      typeof item.productId !== "string" ||
      !item.productName ||
      typeof item.productName !== "string" ||
      !item.productSlug ||
      typeof item.productSlug !== "string" ||
      !item.thumbnail ||
      typeof item.thumbnail !== "string" ||
      typeof item.price !== "number" ||
      item.price < 0 ||
      typeof item.quantity !== "number" ||
      item.quantity <= 0 ||
      item.quantity > 99 
    ) {
      return null;
    }

    // Validate optional fields
    if (item.salePrice !== undefined) {
      if (typeof item.salePrice !== "number" || item.salePrice < 0) {
        return null;
      }
    }

    if (item.size !== undefined && typeof item.size !== "string") {
      return null;
    }

    if (item.color !== undefined && typeof item.color !== "string") {
      return null;
    }

    // Return cleaned item
    return item;
  } catch (error) {
    console.warn("[Cart] Invalid item during validation:", error);
    return null;
  }
}

export const useCartStore = create<CartStoreState>()(
  persist(
    (set) => ({
      items: [] as CartItem[],
      totals: {
        subtotal: 0,
        discount: 0,
        shipping: 0,
        total: 0,
      },
      updatedAt: new Date(),
      hasHydrated: false,

      addItem: (itemInput) => {
        set((state) => {
          const existing = state.items.find(
            (i) =>
              i.productId === itemInput.productId &&
              i.size === itemInput.size &&
              i.color === itemInput.color
          );

          let nextItems: CartItem[];

          if (existing) {
            nextItems = state.items.map((i) =>
              i === existing
                ? { ...i, quantity: i.quantity + itemInput.quantity }
                : i
            );
          } else {
            const id = crypto.randomUUID();
            nextItems = [...state.items, { ...itemInput, id }];
          }

          const totals = computeTotals(nextItems);

          return {
            items: nextItems,
            totals: totals,
            updatedAt: new Date(),
          };
        });

      },

      removeItem: (id) => {
        set((state) => {
          const nextItems = state.items.filter((i) => i.id !== id);
          const totals = computeTotals(nextItems);

          return {
            items: nextItems,
            totals: totals,
            updatedAt: new Date(),
          };
        });
      },

      updateQuantity: (id, quantity) => {
        set((state) => {
          const nextItems = state.items
            .map((i) => (i.id === id ? { ...i, quantity } : i))
            .filter((i) => i.quantity > 0);
          const totals = computeTotals(nextItems);

          return {
            items: nextItems,
            totals: totals,
            updatedAt: new Date(),
          };
        });
      },

      clear: () => {
        set({
          items: [],
          totals: {
            subtotal: 0,
            discount: 0,
            shipping: 0,
            total: 0,
          },
          updatedAt: new Date(),
        });
      },

      removeLines: (lines) => {
        set((state) => {
          const bought = new Set(lines.map(variantKey));
          const nextItems = state.items.filter((i) => !bought.has(variantKey(i)));
          return { items: nextItems, totals: computeTotals(nextItems), updatedAt: new Date() };
        });
      },

      setItems: (items) => {
        const totals = computeTotals(items);
        set({ items, totals, updatedAt: new Date() });
      },

    }),
    {
      name: "bhendi-bazaar-cart",
      // Writes wait for the read: persist saves on every set, and a set before rehydrate (an
      // effect in a child of CartSyncProvider) would overwrite the saved cart with an empty one.
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => {
          if (useCartStore.persist.hasHydrated()) localStorage.setItem(name, value);
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
      // Read by CartSyncProvider (src/app/providers.tsx) after mount, never during the first render.
      skipHydration: true,

      partialize: (state) => ({
        items: state.items,
        updatedAt: state.updatedAt,
      }),

      onRehydrateStorage: () => (state) => {
        // Deferred: the store is being defined when this callback is created.
        queueMicrotask(() => useCartStore.setState({ hasHydrated: true }));
        if (!state) return;

        // Validate and filter corrupted items
        if (state.items && state.items.length > 0) {
          const validItems: CartItem[] = [];
          let corruptedCount = 0;

          for (const item of state.items) {
            const validatedItem = validateCartItem(item);
            if (validatedItem) {
              validItems.push(validatedItem);
            } else {
              corruptedCount++;
              console.warn("[Cart] Removed corrupted item from storage:", item);
            }
          }

          // Update state with only valid items
          state.items = validItems;

          // Recalculate totals
          const totals = computeTotals(validItems);
          state.totals = totals;

          // Log if corruption was detected
          if (corruptedCount > 0) {
            console.warn(
              `[Cart] Cleaned ${corruptedCount} corrupted item(s) from localStorage`
            );
          }
        }
      },
    }
  )
);