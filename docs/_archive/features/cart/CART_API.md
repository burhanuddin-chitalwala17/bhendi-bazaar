# Cart API Integration - Backend Communication

Backend API routes, services, and repositories for cart functionality.

## 📌 Overview

The cart backend handles:
- Cart persistence in database
- Cart retrieval for authenticated users
- Cart merging on login
- Stock validation before checkout

**Architecture**: API Route → Service → Repository → Database

## 📁 Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/app/api/cart/route.ts` | Main cart CRUD API | ~150 |
| `src/app/api/cart/sync/route.ts` | Login merge API | ~100 |
| `src/services/cartService.ts` | Client-side service | ~80 |
| `src/server/services/cartService.ts` | Server service layer | ~120 |
| `src/server/repositories/cartRepository.ts` | Database access | ~94 |

## 🛣️ API Routes

### 1. Get Cart

```
GET /api/cart
```

**Auth**: Required (authenticated users only)

**Response**:
```json
{
  "items": [
    {
      "id": "item_123",
      "productId": "prod_456",
      "name": "Blue T-Shirt",
      "thumbnail": "https://...",
      "price": 999,
      "salePrice": 799,
      "quantity": 2,
      "size": "M",
      "color": "Blue"
    }
  ]
}
```

**Implementation**:
```typescript
// src/app/api/cart/route.ts
import { getServerSession } from "next-auth";
import { cartService } from "@/server/services/cartService";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const items = await cartService.getCart(session.user.id);
    return Response.json({ items });
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch cart" },
      { status: 500 }
    );
  }
}
```

### 2. Update Cart

```
POST /api/cart
```

**Auth**: Required

**Request Body**:
```json
{
  "items": [
    {
      "id": "item_123",
      "productId": "prod_456",
      "name": "Blue T-Shirt",
      "thumbnail": "https://...",
      "price": 999,
      "quantity": 2,
      "size": "M"
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

**Implementation**:
```typescript
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const { items } = await req.json();
    
    await cartService.updateCart(session.user.id, items);
    
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: "Failed to update cart" },
      { status: 500 }
    );
  }
}
```

### 3. Sync Cart (Merge)

```
POST /api/cart/sync
```

**Auth**: Required

**Purpose**: Merge local cart with server cart on login

**Request Body**:
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
      "id": "merged_789",
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

**Implementation**:
```typescript
// src/app/api/cart/sync/route.ts
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const { localItems } = await req.json();
    
    const mergedItems = await cartService.syncCart(
      session.user.id,
      localItems
    );
    
    return Response.json({ items: mergedItems });
  } catch (error) {
    return Response.json(
      { error: "Failed to sync cart" },
      { status: 500 }
    );
  }
}
```

## 🔧 Client Service Layer

**File**: `src/services/cartService.ts`

### Service Interface

```typescript
class CartService {
  private baseUrl = "/api/cart";
  
  async getCart(): Promise<CartItem[]> { }
  async updateCart(items: CartItem[]): Promise<void> { }
  async syncCart(localItems: CartItem[]): Promise<CartItem[]> { }
}

export const cartService = new CartService();
```

### Get Cart Implementation

```typescript
async getCart(): Promise<CartItem[]> {
  try {
    const response = await fetch(this.baseUrl);
    
    if (!response.ok) {
      throw new Error("Failed to fetch cart");
    }
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("[CartService] getCart failed:", error);
    throw error;
  }
}
```

### Update Cart Implementation

```typescript
async updateCart(items: CartItem[]): Promise<void> {
  try {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to update cart");
    }
  } catch (error) {
    console.error("[CartService] updateCart failed:", error);
    throw error;
  }
}
```

### Sync Cart Implementation

```typescript
async syncCart(localItems: CartItem[]): Promise<CartItem[]> {
  try {
    const response = await fetch(`${this.baseUrl}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localItems }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to sync cart");
    }
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("[CartService] syncCart failed:", error);
    throw error;
  }
}
```

## ⚙️ Server Service Layer

**File**: `src/server/services/cartService.ts`

### Service Class

```typescript
export class CartService {
  constructor(private repository: CartRepository) {}
  
  async getCart(userId: string): Promise<CartItem[]> {
    const cart = await this.repository.getByUserId(userId);
    return cart?.items || [];
  }
  
  async updateCart(userId: string, items: CartItem[]): Promise<void> {
    await this.repository.upsert(userId, items);
  }
  
  async syncCart(
    userId: string,
    localItems: CartItem[]
  ): Promise<CartItem[]> {
    // Get server cart
    const serverCart = await this.repository.getByUserId(userId);
    const serverItems = serverCart?.items || [];
    
    // Merge items
    const mergedItems = this.mergeCartItems(serverItems, localItems);
    
    // Save merged cart
    await this.repository.upsert(userId, mergedItems);
    
    return mergedItems;
  }
  
  private mergeCartItems(
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
        // Duplicate: Use higher quantity
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
}

export const cartService = new CartService(cartRepository);
```

## 🗄️ Repository Layer

**File**: `src/server/repositories/cartRepository.ts`

### Repository Class

```typescript
export class CartRepository {
  /**
   * Get cart by user ID
   */
  async getByUserId(userId: string): Promise<ServerCart | null> {
    const cart = await prisma.cart.findUnique({
      where: { userId },
    });
    
    if (!cart) return null;
    
    return {
      id: cart.id,
      userId: cart.userId,
      items: cart.items as CartItem[],
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
  
  /**
   * Create or update cart
   */
  async upsert(userId: string, items: CartItem[]): Promise<ServerCart> {
    const cart = await prisma.cart.upsert({
      where: { userId },
      create: {
        userId,
        items: items as any,
      },
      update: {
        items: items as any,
      },
    });
    
    return {
      id: cart.id,
      userId: cart.userId,
      items: cart.items as CartItem[],
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
  
  /**
   * Delete cart
   */
  async delete(userId: string): Promise<void> {
    await prisma.cart.delete({
      where: { userId },
    });
  }
}

export const cartRepository = new CartRepository();
```

## 🔒 Authentication & Authorization

### Session Verification

All cart API routes require authentication:

```typescript
const session = await getServerSession(authOptions);

if (!session?.user?.id) {
  return Response.json(
    { error: "Unauthorized" },
    { status: 401 }
  );
}
```

### User Isolation

Each user can only access their own cart:

```typescript
// userId from session, not from request
await cartService.getCart(session.user.id);
```

## 🔄 Data Flow Example

### Complete Add to Cart Flow (Authenticated User)

```
1. User clicks "Add to Cart"
   ↓
2. cartStore.addItem() (client)
   - Updates Zustand store
   - Persists to localStorage
   ↓
3. useCartSync detects change
   - After 1s debounce
   ↓
4. cartService.updateCart() (client)
   ↓
5. POST /api/cart (API route)
   - Verifies session
   - Extracts user ID
   ↓
6. cartService.updateCart() (server)
   ↓
7. cartRepository.upsert()
   ↓
8. Prisma updates database
   ↓
9. Success response
   ↓
10. UI shows confirmation
```

## ✅ Stock Validation

### Check Stock Endpoint

```
POST /api/products/check-stock
```

**Request**:
```json
{
  "items": [
    { "productId": "prod_123", "quantity": 2 },
    { "productId": "prod_456", "quantity": 1 }
  ]
}
```

**Response**:
```json
{
  "available": false,
  "items": [
    {
      "productId": "prod_123",
      "name": "Blue T-Shirt",
      "requested": 2,
      "stock": 2,
      "available": true
    },
    {
      "productId": "prod_456",
      "name": "Red Shirt",
      "requested": 1,
      "stock": 0,
      "available": false
    }
  ]
}
```

**Called From**:
- Checkout page (before payment)
- Cart store's `checkStockAvailability()` method

## 🐛 Error Handling

### Network Errors

```typescript
try {
  await cartService.updateCart(items);
} catch (error) {
  if (error instanceof TypeError) {
    // Network error
    toast.error("Connection failed. Check your internet.");
  } else {
    // Server error
    toast.error("Failed to update cart");
  }
}
```

### API Errors

```typescript
// API Route error responses
if (!session) {
  return Response.json(
    { error: "Unauthorized" },
    { status: 401 }
  );
}

if (!items || !Array.isArray(items)) {
  return Response.json(
    { error: "Invalid request body" },
    { status: 400 }
  );
}

try {
  // Business logic
} catch (error) {
  console.error("Cart API error:", error);
  return Response.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
```

## 🔧 Database Schema

### Cart Model

```prisma
model Cart {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  items     Json     // CartItem[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}
```

**JSON Structure** (items field):
```typescript
[
  {
    "id": "item_123",
    "productId": "prod_456",
    "name": "Product Name",
    "thumbnail": "https://...",
    "price": 999,
    "salePrice": 799,
    "quantity": 2,
    "size": "M",
    "color": "Blue"
  }
]
```

## 🚀 Performance Considerations

1. **Debounced Updates**: Client debounces to reduce API calls
2. **Upsert Operation**: Efficient create-or-update in single query
3. **JSON Storage**: Fast read/write without joins
4. **Indexed Queries**: userId indexed for fast lookups

## ✅ Testing

### API Route Testing

```typescript
// Test GET /api/cart
describe("GET /api/cart", () => {
  it("returns cart for authenticated user", async () => {
    const response = await fetch("/api/cart", {
      headers: { Cookie: sessionCookie },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toBeInstanceOf(Array);
  });
  
  it("returns 401 for unauthenticated user", async () => {
    const response = await fetch("/api/cart");
    expect(response.status).toBe(401);
  });
});
```

---

**Complete!** This concludes the Cart system documentation.

**Next Feature**: [Admin Products Management](../admin-products/README.md)

**Last Updated**: December 2025

