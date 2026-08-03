# Cart Synchronization - Server Sync Mechanism

How the cart synchronizes between client (localStorage) and server (database) for authenticated users.

## 📌 Overview

Cart synchronization ensures authenticated users have a consistent cart across devices and sessions using:
- **Automatic sync on login** - Merges local and server carts
- **Debounced background sync** - Updates server after changes (1s delay)
- **Optimistic updates** - UI updates immediately, sync happens in background
- **Error handling** - Graceful fallback to local-only mode

**File**: `src/hooks/useCartSync.ts` (93 lines)

## 🏗️ Sync Architecture

```
┌──────────────────────────────────────────────────────────┐
│              CART SYNC FLOW                               │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  User State: Guest → Authenticated                        │
│                                                           │
│  1. LOGIN EVENT                                           │
│     ↓                                                     │
│     useCartSync detects authentication                    │
│     ↓                                                     │
│     syncOnLogin() triggered                               │
│     ↓                                                     │
│     POST /api/cart/sync                                   │
│     {                                                     │
│       localItems: [...]  // Items from localStorage       │
│     }                                                     │
│     ↓                                                     │
│     Server merges: server cart + local cart               │
│     ↓                                                     │
│     Returns merged cart                                   │
│     ↓                                                     │
│     Update Zustand store                                  │
│     ↓                                                     │
│     Update localStorage                                   │
│                                                           │
│  2. CART CHANGE (while authenticated)                     │
│     ↓                                                     │
│     User adds/removes item                                │
│     ↓                                                     │
│     Zustand store updated immediately                     │
│     ↓                                                     │
│     useCartSync detects change                            │
│     ↓                                                     │
│     Debounce timer started (1000ms)                       │
│     ↓                                                     │
│     Timer expires → syncToServer()                        │
│     ↓                                                     │
│     POST /api/cart                                        │
│     { items: [...] }                                      │
│     ↓                                                     │
│     Server updates database                               │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

## 🔧 useCartSync Hook

### Hook Structure

```typescript
export function useCartSync() {
  const { data: session, status } = useSession();
  const items = useCartStore((state) => state.items);
  const setItems = useCartStore((state) => state.setItems);
  const setSyncing = useCartStore((state) => state.setSyncing);
  const setSyncError = useCartStore((state) => state.setSyncError);
  
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedItemsRef = useRef<string>("");
  const hasSyncedOnLoginRef = useRef(false);
  
  // Sync functions
  const syncOnLogin = useCallback(async () => { /* ... */ }, []);
  const syncToServer = useCallback(async () => { /* ... */ }, []);
  
  // Effects
  useEffect(() => { /* Login sync */ }, [status]);
  useEffect(() => { /* Change sync */ }, [items, status]);
  
  return { isSyncing, syncError };
}
```

### Refs Explained

| Ref | Purpose |
|-----|---------|
| `syncTimeoutRef` | Stores debounce timer ID |
| `lastSyncedItemsRef` | Prevents duplicate syncs |
| `hasSyncedOnLoginRef` | Ensures one-time login sync |

## 🎯 Sync Functions

### 1. Login Sync

```typescript
const syncOnLogin = useCallback(async () => {
  if (!session?.user?.id || hasSyncedOnLoginRef.current) return;
  
  try {
    setSyncing(true);
    setSyncError(null);
    
    // Merge local and server carts
    const mergedItems = await cartService.syncCart(items);
    
    // Update store
    setItems(mergedItems);
    lastSyncedItemsRef.current = JSON.stringify(mergedItems);
    hasSyncedOnLoginRef.current = true;
  } catch (error) {
    console.error("[useCartSync] Login sync failed:", error);
    setSyncError("Failed to sync cart");
  } finally {
    setSyncing(false);
  }
}, [session?.user?.id, items, setItems, setSyncing, setSyncError]);
```

**When Called**: Once immediately after user authenticates

**Flow**:
1. Check if already synced (prevent duplicate)
2. Call cartService.syncCart() with local items
3. Server merges with database cart
4. Update store with merged result
5. Mark as synced

### 2. Background Sync

```typescript
const syncToServer = useCallback(
  async (cartItems: typeof items) => {
    if (!session?.user?.id) return;
    
    try {
      await cartService.updateCart(cartItems);
      lastSyncedItemsRef.current = JSON.stringify(cartItems);
      setSyncError(null);
    } catch (error) {
      console.error("[useCartSync] Background sync failed:", error);
      setSyncError("Failed to sync cart");
    }
  },
  [session?.user?.id, setSyncError]
);
```

**When Called**: After cart changes (debounced)

**Flow**:
1. Send current cart to server
2. Server replaces entire cart
3. Update sync status
4. No store update needed (already updated optimistically)

## ⏱️ Debouncing Logic

### Change Detection Effect

```typescript
useEffect(() => {
  // Only sync if authenticated and has synced on login
  if (status !== "authenticated" || !hasSyncedOnLoginRef.current) {
    return;
  }
  
  const currentItemsStr = JSON.stringify(items);
  
  // Skip if no changes
  if (currentItemsStr === lastSyncedItemsRef.current) {
    return;
  }
  
  // Clear existing timeout
  if (syncTimeoutRef.current) {
    clearTimeout(syncTimeoutRef.current);
  }
  
  // Start new timeout
  syncTimeoutRef.current = setTimeout(() => {
    syncToServer(items);
  }, 1000); // 1 second delay
  
  // Cleanup
  return () => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
  };
}, [items, status, syncToServer]);
```

**Why Debounce?**
- Prevents API spam when user rapidly changes cart
- Batch multiple changes into single request
- Better performance and UX

**Example Scenario**:
```
User adds 3 items quickly:
  0ms: Add Item 1 → Start 1s timer
  200ms: Add Item 2 → Cancel timer, start new 1s timer
  500ms: Add Item 3 → Cancel timer, start new 1s timer
  1500ms: Timer expires → Sync all 3 items in one request
```

## 🔄 Merge Strategy

### Server-Side Merge (in API route)

```typescript
// POST /api/cart/sync
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const { localItems } = await req.json();
  
  // Get server cart
  const serverCart = await cartRepository.getByUserId(session.user.id);
  const serverItems = serverCart?.items || [];
  
  // Merge logic
  const merged = mergeCartItems(serverItems, localItems);
  
  // Save merged cart
  await cartRepository.upsert(session.user.id, merged);
  
  return Response.json({ items: merged });
}
```

### Merge Logic

```typescript
function mergeCartItems(
  serverItems: CartItem[], 
  localItems: CartItem[]
): CartItem[] {
  const merged = [...serverItems];
  
  for (const localItem of localItems) {
    const existingIndex = merged.findIndex(item =>
      item.productId === localItem.productId &&
      item.size === localItem.size &&
      item.color === localItem.color
    );
    
    if (existingIndex >= 0) {
      // Duplicate found: Use higher quantity
      merged[existingIndex].quantity = Math.max(
        merged[existingIndex].quantity,
        localItem.quantity
      );
    } else {
      // New item: Add to cart
      merged.push(localItem);
    }
  }
  
  return merged;
}
```

**Merge Rules**:
1. Keep all server items
2. Add unique local items
3. For duplicates: Use higher quantity
4. Preserve item IDs

## 🎨 UI Integration

### Provider Setup

```typescript
// app/providers.tsx
function CartSyncProvider({ children }: { children: React.ReactNode }) {
  useCartSync(); // Initialize sync globally
  return <>{children}</>;
}

export function Providers({ children }) {
  return (
    <SessionProvider>
      <CartSyncProvider>
        {children}
      </CartSyncProvider>
    </SessionProvider>
  );
}
```

**Why in Provider?**
- Runs once at app level
- Persists across navigation
- Always monitoring auth changes

### Sync Status Display

```typescript
"use client";
import { useCartStore } from "@/store/cartStore";

export function CartSyncIndicator() {
  const isSyncing = useCartStore((state) => state.isSyncing);
  const syncError = useCartStore((state) => state.lastSyncError);
  
  if (syncError) {
    return (
      <div className="text-red-500 text-sm">
        ⚠️ Sync failed. Your cart is saved locally.
      </div>
    );
  }
  
  if (isSyncing) {
    return (
      <div className="text-gray-500 text-sm">
        🔄 Syncing cart...
      </div>
    );
  }
  
  return null;
}
```

## 📡 API Endpoints

### 1. Sync Cart (Merge)

```
POST /api/cart/sync
```

**Request**:
```json
{
  "localItems": [
    {
      "id": "local_123",
      "productId": "prod_456",
      "quantity": 2,
      ...
    }
  ]
}
```

**Response**:
```json
{
  "items": [
    {
      "id": "server_789",
      "productId": "prod_111",
      "quantity": 1,
      ...
    },
    {
      "id": "local_123",
      "productId": "prod_456",
      "quantity": 2,
      ...
    }
  ]
}
```

### 2. Update Cart (Replace)

```
POST /api/cart
```

**Request**:
```json
{
  "items": [
    {
      "id": "item_123",
      "productId": "prod_456",
      "quantity": 3,
      ...
    }
  ]
}
```

**Response**:
```json
{
  "success": true
}
```

## 🔒 Authentication Handling

### Guest User (Not Synced)

```typescript
Status: "unauthenticated"
  ↓
Sync hook does nothing
  ↓
Cart only in localStorage
```

### Authenticated User

```typescript
Status: "authenticated"
  ↓
First render: syncOnLogin()
  ↓
Merge local + server carts
  ↓
On changes: debounced syncToServer()
```

### Logout

```typescript
User logs out
  ↓
Status: "unauthenticated"
  ↓
Reset hasSyncedOnLoginRef = false
  ↓
Cart remains in localStorage
  ↓
No more syncing until next login
```

## 🐛 Error Handling

### Network Failure

```typescript
try {
  await cartService.syncCart(items);
} catch (error) {
  // Set error state
  setSyncError("Failed to sync cart");
  
  // Cart remains in localStorage
  // User can continue shopping
  
  // Show non-blocking error message
  console.error("Sync failed:", error);
}
```

**User Experience**:
- Cart still works (localStorage fallback)
- Warning message shown
- Can retry by refreshing

### Partial Sync

If sync fails during checkout:
1. Cart is validated before payment
2. If validation fails, show specific errors
3. User can adjust cart and retry

## 📊 Sync Scenarios

### Scenario 1: Guest Adds Items, Then Logs In

```
1. Guest adds Item A (qty: 2) → localStorage
2. Guest adds Item B (qty: 1) → localStorage
3. Guest logs in
4. Server has: Item A (qty: 1), Item C (qty: 3)
5. Merge result:
   - Item A: qty 2 (local higher)
   - Item B: qty 1 (only in local)
   - Item C: qty 3 (only in server)
```

### Scenario 2: User Shops on Multiple Devices

```
Device 1:
  Adds Item X (qty: 2)
  Syncs to server ✓

Device 2:
  Logs in
  Fetches from server
  Shows Item X (qty: 2) ✓
```

### Scenario 3: Rapid Cart Changes

```
0ms: Add Item 1
100ms: Add Item 2
200ms: Remove Item 1
300ms: Update Item 2 qty

Result: Only 1 sync request at 1300ms
Payload: Current state (Item 2 only)
```

## 🚀 Performance Considerations

### Optimization Techniques

1. **Debouncing**: Reduces API calls
2. **String Comparison**: Fast change detection
3. **Refs for Timers**: Avoids memory leaks
4. **Background Sync**: Non-blocking UI
5. **Optimistic Updates**: Instant feedback

### Network Efficiency

**Without Sync**: 0 requests
**With Sync** (typical session):
- Login: 1 request (merge)
- 5 cart changes: 1-2 requests (debounced)
- Total: 2-3 requests per session

## ✅ Testing Sync

### Manual Test Cases

1. **Guest to User**:
   - Add items as guest
   - Sign in
   - Verify items persisted

2. **Cross-Device**:
   - Add items on Device A
   - Sign in on Device B
   - Verify cart synced

3. **Rapid Changes**:
   - Quickly add/remove items
   - Check network tab for single sync

4. **Offline Mode**:
   - Disconnect network
   - Make cart changes
   - Reconnect
   - Verify eventually syncs

---

**Next**: [Cart UI Components](./CART_UI.md) - UI implementation

**Last Updated**: December 2025

