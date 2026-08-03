# Cart State Management - Zustand Store

Deep dive into the cart state management using Zustand with persistence and synchronization.

## 📌 Overview

The cart store is the heart of the shopping cart system, built with Zustand for:
- **Global State**: Accessible from any component
- **Persistence**: Survives page refreshes via localStorage
- **Type Safety**: Full TypeScript support
- **Simplicity**: No boilerplate, simple API

**File**: `src/store/cartStore.ts` (230 lines)

## 🏗️ Store Architecture

```typescript
┌─────────────────────────────────────────────┐
│          CartStore (Zustand)                │
├─────────────────────────────────────────────┤
│                                             │
│  State:                                     │
│    • items: CartItem[]                      │
│    • subtotal: number                       │
│    • discount: number                       │
│    • total: number                          │
│    • buyNowItem: CartItem | null            │
│    • isSyncing: boolean                     │
│    • lastSyncError: string | null           │
│                                             │
│  Actions:                                   │
│    • addItem()                              │
│    • removeItem()                           │
│    • updateQuantity()                       │
│    • updateQuantityWithLimit()              │
│    • clear()                                │
│    • setBuyNowItem()                        │
│    • clearBuyNow()                          │
│    • setItems()                             │
│    • setSyncing()                           │
│    • setSyncError()                         │
│    • checkStockAvailability()               │
│                                             │
└─────────────────────────────────────────────┘
         ↓ Persisted to
┌─────────────────────────────────────────────┐
│         localStorage                        │
│   Key: "bhendi-bazaar-cart"                 │
│   Value: { items: CartItem[] }              │
└─────────────────────────────────────────────┘
```

## 🔧 Store Configuration

### Basic Setup

```typescript
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const useCartStore = create<CartStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
      
      // Actions
      addItem: (itemInput) => { /* ... */ },
      // ... more actions
    }),
    {
      name: "bhendi-bazaar-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items, // Only persist items
      }),
    }
  )
);
```

### Key Configuration Options

| Option | Value | Purpose |
|--------|-------|---------|
| `name` | "bhendi-bazaar-cart" | localStorage key |
| `storage` | localStorage | Where to persist |
| `partialize` | { items } | Only save items array |

**Why partialize?**
- Subtotal/discount/total are computed values
- buyNowItem is temporary (don't persist)
- Sync status is transient

## 📊 State Properties

### Core Cart State

```typescript
items: CartItem[]
```
- Array of all cart items
- Each item has unique ID
- Persisted to localStorage

```typescript
subtotal: number
discount: number
total: number
```
- **subtotal**: Sum of all items (before discounts)
- **discount**: Total discount amount
- **total**: Final amount (subtotal - discount)
- Computed automatically on every cart change

### Buy Now State

```typescript
buyNowItem: CartItem | null
```
- Temporary single-item storage
- Used for "Buy Now" feature
- Not persisted
- Cleared after purchase

### Sync Status

```typescript
isSyncing: boolean
lastSyncError: string | null
```
- Tracks sync operation status
- Used for loading indicators
- Error messages for user feedback

## 🎯 Core Actions

### 1. Adding Items

```typescript
addItem: (itemInput: Omit<CartItem, "id">) => void
```

**Logic**:
1. Check if item already exists (same product + size + color)
2. If exists: Increase quantity
3. If new: Generate ID and add to array
4. Recalculate totals
5. Update state

**Example Usage**:
```typescript
const addItem = useCartStore((state) => state.addItem);

addItem({
  productId: "prod_123",
  name: "Blue T-Shirt",
  thumbnail: "/images/shirt.jpg",
  price: 999,
  salePrice: 799,
  quantity: 1,
  size: "M",
  color: "Blue",
});
```

**Item Matching**: Items are considered duplicates if all match:
- Same `productId`
- Same `size`
- Same `color`

### 2. Removing Items

```typescript
removeItem: (id: string) => void
```

**Logic**:
1. Filter out item by ID
2. Recalculate totals
3. Update state

**Example**:
```typescript
const removeItem = useCartStore((state) => state.removeItem);

removeItem("item_123");
```

### 3. Updating Quantity

#### Standard Update
```typescript
updateQuantity: (id: string, quantity: number) => void
```

**Logic**:
1. Find item by ID
2. Update quantity
3. If quantity <= 0: Remove item
4. Recalculate totals

**Example**:
```typescript
const updateQuantity = useCartStore((state) => state.updateQuantity);

updateQuantity("item_123", 3); // Set to 3
updateQuantity("item_123", 0); // Remove item
```

#### With Stock Limit
```typescript
updateQuantityWithLimit: (
  id: string, 
  quantity: number, 
  maxStock: number
) => boolean
```

**Logic**:
1. Check if quantity exceeds maxStock
2. If exceeds: Return false, don't update
3. If valid: Update quantity, return true

**Example**:
```typescript
const updateQuantityWithLimit = useCartStore(
  (state) => state.updateQuantityWithLimit
);

const success = updateQuantityWithLimit("item_123", 5, 3);
if (!success) {
  toast.error("Only 3 items available");
}
```

**Use Case**: During cart page when real-time stock is known

### 4. Clearing Cart

```typescript
clear: () => void
```

**Logic**:
1. Reset items to empty array
2. Reset all totals to 0
3. Keep sync status unchanged

**Example**:
```typescript
const clear = useCartStore((state) => state.clear);

// After successful order
clear();
```

## 💰 Total Calculation

### Compute Function

```typescript
function computeTotals(items: CartItem[]) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  
  const discount = items.reduce(
    (sum, item) =>
      sum + (item.salePrice 
        ? (item.price - item.salePrice) * item.quantity 
        : 0),
    0
  );
  
  return { 
    subtotal, 
    discount, 
    total: subtotal - discount 
  };
}
```

**Called Automatically**:
- After addItem
- After removeItem
- After updateQuantity
- After setItems (from sync)

### Example Calculation

```typescript
Items:
  1. Regular T-Shirt: ₹1000 × 2 = ₹2000
  2. Sale Shirt: ₹1500 (sale: ₹1200) × 1 = ₹1500

Subtotal: ₹2000 + ₹1500 = ₹3500
Discount: ₹0 + (₹1500 - ₹1200) = ₹300
Total: ₹3500 - ₹300 = ₹3200
```

## 🛒 Buy Now Feature

### Set Buy Now Item

```typescript
setBuyNowItem: (itemInput: Omit<CartItem, "id"> | null) => void
```

**Logic**:
1. Generate unique ID with "buynow-" prefix
2. Set as buyNowItem
3. Don't affect main cart

**Example**:
```typescript
const setBuyNowItem = useCartStore((state) => state.setBuyNowItem);

// User clicks "Buy Now"
setBuyNowItem({
  productId: "prod_123",
  name: "Premium Watch",
  thumbnail: "/watch.jpg",
  price: 5999,
  quantity: 1,
});

// Navigate to checkout with buyNowItem
```

### Clear Buy Now

```typescript
clearBuyNow: () => void
```

**When to call**:
- After successful purchase
- User cancels checkout
- User goes back to shopping

## ✅ Stock Validation

```typescript
checkStockAvailability: () => Promise<{
  available: boolean;
  issues: Array<{ productId: string; message: string }>;
}>
```

**Purpose**: Validate cart items against current stock before checkout

**Logic**:
1. Extract product IDs and quantities
2. POST to `/api/products/check-stock`
3. Server checks each item's stock
4. Return validation results

**Example**:
```typescript
const checkStock = useCartStore((state) => state.checkStockAvailability);

// At checkout
const { available, issues } = await checkStock();

if (!available) {
  issues.forEach(issue => {
    toast.error(issue.message);
  });
  return; // Don't proceed to payment
}

// Stock available, proceed to payment
```

**Response Example**:
```typescript
{
  available: false,
  issues: [
    {
      productId: "prod_123",
      message: "Only 2 available for Blue T-Shirt (you requested 5)"
    }
  ]
}
```

## 🔄 Sync Helpers

### Set Items (From Server)

```typescript
setItems: (items: CartItem[]) => void
```

**Used by**: useCartSync hook after fetching from server

**Logic**:
1. Replace entire items array
2. Recalculate totals
3. Update state

### Sync Status

```typescript
setSyncing: (syncing: boolean) => void
setSyncError: (error: string | null) => void
```

**Usage**: Display loading/error states in UI

## 🎨 Using the Store in Components

### Accessing State

```typescript
// Get all items
const items = useCartStore((state) => state.items);

// Get computed total
const total = useCartStore((state) => state.total);

// Get sync status
const isSyncing = useCartStore((state) => state.isSyncing);
```

### Accessing Actions

```typescript
// Get multiple actions
const { addItem, removeItem, clear } = useCartStore((state) => ({
  addItem: state.addItem,
  removeItem: state.removeItem,
  clear: state.clear,
}));

// Or get single action
const addItem = useCartStore((state) => state.addItem);
```

### Computed Values

```typescript
const itemCount = useCartStore((state) => 
  state.items.reduce((sum, item) => sum + item.quantity, 0)
);

const hasItems = useCartStore((state) => state.items.length > 0);

const firstItem = useCartStore((state) => state.items[0]);
```

## 🔍 Performance Optimization

### Selective Subscription

**Bad** (re-renders on any state change):
```typescript
const store = useCartStore();
```

**Good** (only re-renders when items change):
```typescript
const items = useCartStore((state) => state.items);
```

### Computed Selectors

```typescript
// Memoize complex calculations
const cartSummary = useCartStore((state) => ({
  count: state.items.reduce((sum, item) => sum + item.quantity, 0),
  total: state.total,
  hasItems: state.items.length > 0,
}), shallow); // Use shallow comparison
```

## 🐛 Debugging

### View Store State

```typescript
// In browser console
localStorage.getItem('bhendi-bazaar-cart');

// Or use Zustand devtools
import { devtools } from 'zustand/middleware';
```

### Common Issues

**Issue**: Cart cleared on refresh
- Check localStorage in DevTools
- Verify persist middleware configuration
- Check browser privacy settings

**Issue**: Totals not updating
- Verify computeTotals() is called in all mutations
- Check for direct state mutations (don't mutate, use set())

---

**Next**: [Cart Synchronization](./CART_SYNC.md) - How cart syncs with server

**Last Updated**: December 2025

