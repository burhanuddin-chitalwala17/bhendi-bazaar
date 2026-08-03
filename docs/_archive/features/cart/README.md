# Shopping Cart System - Overview

Complete guide to the Bhendi Bazaar shopping cart system with state management and synchronization.

## 📌 Quick Summary

The cart system provides a seamless shopping experience with:
- **Client-side cart** (localStorage) for guest users
- **Server-side persistence** for authenticated users
- **Automatic synchronization** between client and server
- **Real-time stock validation** at checkout
- **Buy Now** feature for single-item purchases

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CART SYSTEM                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Guest User Flow:                                        │
│    User Actions → Zustand Store → localStorage          │
│                                                          │
│  Authenticated User Flow:                                │
│    User Actions → Zustand Store → localStorage          │
│                      ↓                                   │
│                 Cart Sync Hook (debounced)               │
│                      ↓                                   │
│            Client Service → API Route                    │
│                      ↓                                   │
│            Server Service → Repository                   │
│                      ↓                                   │
│                   Database                               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 📁 Key Files

### State Management
| File | Purpose | Lines |
|------|---------|-------|
| `src/store/cartStore.ts` | Zustand cart store | 230 |
| `src/hooks/useCartSync.ts` | Sync hook for auth users | 93 |
| `src/domain/cart.ts` | Type definitions | 34 |

### UI Components
| File | Purpose | Lines |
|------|---------|-------|
| `src/app/(main)/cart/page.tsx` | Cart page | ~200 |
| `src/components/cart/cart-line-items.tsx` | Cart items list | ~150 |
| `src/components/cart/cart-summary.tsx` | Cart totals | ~120 |
| `src/components/layout/navbar.tsx` | Cart icon/badge | ~300 |

### Backend
| File | Purpose | Lines |
|------|---------|-------|
| `src/app/api/cart/route.ts` | Cart API route | ~150 |
| `src/app/api/cart/sync/route.ts` | Sync API route | ~100 |
| `src/services/cartService.ts` | Client cart service | ~80 |
| `src/server/services/cartService.ts` | Server cart service | ~120 |
| `src/server/repositories/cartRepository.ts` | Cart repository | ~94 |

## 🎯 Core Features

### 1. Add to Cart
- Add products with quantity, size, and color
- Duplicate detection (same product + variant = increase quantity)
- Instant UI update
- Auto-sync for authenticated users

### 2. Update Cart
- Change quantity (with stock limits)
- Remove items
- Clear entire cart
- Persist changes

### 3. Cart Synchronization
- **On Login**: Merge local cart with server cart
- **On Changes**: Debounced sync (1s delay)
- **Background Sync**: Non-blocking
- **Error Handling**: Graceful fallback to local cart

### 4. Stock Validation
- Real-time stock checks at checkout
- Prevents over-ordering
- Clear error messages

### 5. Buy Now
- Skip cart, go directly to checkout
- Temporary single-item storage
- Cleared after purchase

## 🔄 Data Flow Examples

### Adding Product to Cart (Guest User)
```
1. User clicks "Add to Cart" on product page
2. cartStore.addItem() called
3. Item added to Zustand store
4. Store automatically persists to localStorage
5. Cart badge updates in navbar
6. Toast notification shown
```

### Adding Product to Cart (Authenticated User)
```
1. User clicks "Add to Cart"
2. cartStore.addItem() called
3. Item added to Zustand store
4. Persisted to localStorage
5. useCartSync hook detects change
6. After 1s debounce: POST /api/cart
7. Server updates database cart
8. UI updated, toast shown
```

### Login with Existing Local Cart
```
1. User has items in local cart (guest)
2. User signs in
3. useCartSync detects authentication
4. POST /api/cart/sync with local items
5. Server merges:
   - Server cart items
   - Local cart items
   - Combines duplicates
6. Merged cart returned
7. Store updated with merged cart
8. User sees all items
```

## 📊 Cart Data Structure

### CartItem Interface
```typescript
interface CartItem {
  id: string;              // Unique identifier
  productId: string;       // Product reference
  name: string;            // Product name
  thumbnail: string;       // Product image URL
  price: number;           // Regular price
  salePrice?: number;      // Sale price (if any)
  quantity: number;        // Quantity
  size?: string;           // Selected size
  color?: string;          // Selected color
}
```

### CartTotals Interface
```typescript
interface CartTotals {
  subtotal: number;        // Sum of all items
  discount: number;        // Total discount amount
  total: number;           // Final amount
}
```

## 🎨 User Experience Features

### Visual Feedback
- Loading spinners during sync
- Toast notifications for actions
- Cart badge with item count
- Empty cart state with CTA
- Error messages for issues

### Performance
- Instant UI updates (optimistic)
- Debounced API calls (1s)
- Background sync (non-blocking)
- localStorage caching

### Accessibility
- Keyboard navigation
- Screen reader support
- ARIA labels
- Focus management

## 🔗 Related Documentation

**Detailed Guides:**
- [Cart State Management](./CART_STATE.md) - Zustand store deep dive
- [Cart Synchronization](./CART_SYNC.md) - Sync mechanism explained
- [Cart UI Components](./CART_UI.md) - UI implementation
- [Cart API Integration](./CART_API.md) - Backend integration

**Related Features:**
- [Checkout Process](../checkout/README.md) - How cart data flows to checkout
- [Product Pages](../products/README.md) - Add to cart implementation
- [Authentication](../../integrations/NEXTAUTH.md) - User authentication

**Database:**
- [Cart Model](../../database/SCHEMA_OVERVIEW.md#6-cart-model) - Database schema

## 🚀 Quick Start for Developers

### Using the Cart in Components

```typescript
"use client";
import { useCartStore } from "@/store/cartStore";

export function ProductCard({ product }) {
  const addItem = useCartStore((state) => state.addItem);
  
  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      thumbnail: product.thumbnail,
      price: product.price,
      salePrice: product.salePrice,
      quantity: 1,
      size: selectedSize,
      color: selectedColor,
    });
    
    toast.success("Added to cart!");
  };
  
  return (
    <button onClick={handleAddToCart}>
      Add to Cart
    </button>
  );
}
```

### Accessing Cart Data

```typescript
const items = useCartStore((state) => state.items);
const total = useCartStore((state) => state.total);
const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
```

## 🐛 Common Issues & Solutions

### Issue: Cart not syncing
**Solution**: Check network tab, verify authentication, check useCartSync hook

### Issue: Stock validation fails
**Solution**: Ensure checkStockAvailability() is called before checkout

### Issue: Cart cleared on page refresh
**Solution**: Check localStorage persistence, verify Zustand persist config

### Issue: Duplicate items created
**Solution**: Check item matching logic (productId + size + color)

## 📈 Future Enhancements

- [ ] Cart expiration (remove old items)
- [ ] Wishlist/Save for later
- [ ] Cart sharing (shareable URL)
- [ ] Recently removed items recovery
- [ ] Quantity picker improvements
- [ ] Multiple cart support (different stores)

---

**Last Updated**: December 2025  
**Maintained By**: Bhendi Bazaar Development Team

