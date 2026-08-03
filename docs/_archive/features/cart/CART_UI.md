# Cart UI Components

User interface components for the shopping cart, including the cart page, line items, and summary sections.

## 📌 Overview

The cart UI provides a clean, intuitive interface for users to:
- View all cart items with product details
- Update quantities
- Remove items
- See price calculations
- Proceed to checkout
- Handle empty cart state

**Key Files**:
- `src/app/(main)/cart/page.tsx` - Cart page (~200 lines)
- `src/components/cart/cart-line-items.tsx` - Item list (~150 lines)
- `src/components/cart/cart-summary.tsx` - Price summary (~120 lines)

## 🏗️ Component Hierarchy

```
CartPage
├── CartLineItems
│   └── (for each item)
│       ├── Product Image
│       ├── Product Info (name, variant)
│       ├── Price Display
│       ├── Quantity Selector
│       └── Remove Button
│
└── CartSummary
    ├── Subtotal
    ├── Discount (if any)
    ├── Total
    └── Checkout Button
```

## 📄 Cart Page Component

**File**: `src/app/(main)/cart/page.tsx`

### Basic Structure

```typescript
"use client";
import { useCartStore } from "@/store/cartStore";
import { CartLineItems } from "@/components/cart/cart-line-items";
import { CartSummary } from "@/components/cart/cart-summary";

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);
  
  // Empty cart state
  if (items.length === 0) {
    return <EmptyCartState />;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <CartLineItems items={items} />
        </div>
        
        {/* Cart Summary */}
        <div className="lg:col-span-1">
          <CartSummary />
        </div>
      </div>
    </div>
  );
}
```

### Empty Cart State

```typescript
function EmptyCartState() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <ShoppingBag className="w-24 h-24 mx-auto text-gray-300" />
      <h2 className="text-2xl font-heading font-bold mt-6">
        Your cart is empty
      </h2>
      <p className="text-gray-600 mt-2">
        Add items to get started
      </p>
      <Link 
        href="/"
        className="inline-block mt-8 px-6 py-3 bg-emerald-600 text-white rounded-lg"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
```

**Features**:
- Large icon visual
- Clear message
- CTA button to homepage
- Centered layout

## 🛒 Cart Line Items Component

**File**: `src/components/cart/cart-line-items.tsx`

### Component Structure

```typescript
interface CartLineItemsProps {
  items: CartItem[];
}

export function CartLineItems({ items }: CartLineItemsProps) {
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-heading font-bold">
        Shopping Cart ({items.length} items)
      </h1>
      
      {items.map((item) => (
        <CartLineItem
          key={item.id}
          item={item}
          onUpdateQuantity={updateQuantity}
          onRemove={removeItem}
          isUpdating={updatingId === item.id}
        />
      ))}
    </div>
  );
}
```

### Individual Line Item

```typescript
interface CartLineItemProps {
  item: CartItem;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  isUpdating: boolean;
}

function CartLineItem({ 
  item, 
  onUpdateQuantity, 
  onRemove,
  isUpdating 
}: CartLineItemProps) {
  const [quantity, setQuantity] = useState(item.quantity);
  
  const handleQuantityChange = (newQty: number) => {
    if (newQty < 1) return;
    setQuantity(newQty);
    onUpdateQuantity(item.id, newQty);
  };
  
  const handleRemove = () => {
    if (confirm("Remove this item from cart?")) {
      onRemove(item.id);
      toast.success("Item removed");
    }
  };
  
  const displayPrice = item.salePrice || item.price;
  const hasDiscount = !!item.salePrice;
  
  return (
    <div className="flex gap-4 p-4 border rounded-lg">
      {/* Product Image */}
      <Link href={`/product/${item.productId}`}>
        <Image
          src={item.thumbnail}
          alt={item.name}
          width={100}
          height={100}
          className="rounded-lg object-cover"
        />
      </Link>
      
      {/* Product Info */}
      <div className="flex-1">
        <Link 
          href={`/product/${item.productId}`}
          className="font-medium hover:text-emerald-600"
        >
          {item.name}
        </Link>
        
        {/* Variant Info */}
        {(item.size || item.color) && (
          <p className="text-sm text-gray-600 mt-1">
            {item.size && `Size: ${item.size}`}
            {item.size && item.color && " • "}
            {item.color && `Color: ${item.color}`}
          </p>
        )}
        
        {/* Price */}
        <div className="mt-2">
          {hasDiscount ? (
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">
                ₹{displayPrice.toFixed(2)}
              </span>
              <span className="text-sm text-gray-500 line-through">
                ₹{item.price.toFixed(2)}
              </span>
            </div>
          ) : (
            <span className="text-lg font-semibold">
              ₹{displayPrice.toFixed(2)}
            </span>
          )}
        </div>
      </div>
      
      {/* Quantity Selector */}
      <div className="flex flex-col items-end gap-2">
        <QuantitySelector
          value={quantity}
          onChange={handleQuantityChange}
          disabled={isUpdating}
        />
        
        {/* Remove Button */}
        <button
          onClick={handleRemove}
          className="text-red-500 hover:text-red-700 text-sm"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        
        {/* Line Total */}
        <p className="text-sm font-medium mt-auto">
          ₹{(displayPrice * quantity).toFixed(2)}
        </p>
      </div>
    </div>
  );
}
```

### Quantity Selector Component

```typescript
interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}

function QuantitySelector({ 
  value, 
  onChange, 
  disabled = false,
  min = 1,
  max = 99
}: QuantitySelectorProps) {
  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };
  
  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };
  
  return (
    <div className="flex items-center border rounded-lg">
      <button
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className="px-3 py-1 hover:bg-gray-100 disabled:opacity-50"
      >
        <Minus className="w-4 h-4" />
      </button>
      
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || min)}
        disabled={disabled}
        min={min}
        max={max}
        className="w-16 text-center border-x py-1"
      />
      
      <button
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className="px-3 py-1 hover:bg-gray-100 disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
```

## 💰 Cart Summary Component

**File**: `src/components/cart/cart-summary.tsx`

### Component Structure

```typescript
export function CartSummary() {
  const { subtotal, discount, total } = useCartStore((state) => ({
    subtotal: state.subtotal,
    discount: state.discount,
    total: state.total,
  }));
  const router = useRouter();
  const { status } = useSession();
  
  const handleCheckout = () => {
    if (status === "unauthenticated") {
      router.push("/signin?callbackUrl=/checkout");
      return;
    }
    
    router.push("/checkout");
  };
  
  return (
    <div className="border rounded-lg p-6 sticky top-4">
      <h2 className="text-xl font-heading font-bold mb-4">
        Order Summary
      </h2>
      
      {/* Subtotal */}
      <div className="flex justify-between text-gray-600 mb-2">
        <span>Subtotal</span>
        <span>₹{subtotal.toFixed(2)}</span>
      </div>
      
      {/* Discount (if any) */}
      {discount > 0 && (
        <div className="flex justify-between text-green-600 mb-2">
          <span>Discount</span>
          <span>-₹{discount.toFixed(2)}</span>
        </div>
      )}
      
      {/* Shipping */}
      <div className="flex justify-between text-gray-600 mb-2">
        <span>Shipping</span>
        <span className="text-green-600">FREE</span>
      </div>
      
      <div className="border-t my-4" />
      
      {/* Total */}
      <div className="flex justify-between text-lg font-bold mb-6">
        <span>Total</span>
        <span>₹{total.toFixed(2)}</span>
      </div>
      
      {/* Checkout Button */}
      <button
        onClick={handleCheckout}
        className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
      >
        Proceed to Checkout
      </button>
      
      {/* Continue Shopping Link */}
      <Link
        href="/"
        className="block text-center text-emerald-600 mt-4 hover:underline"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
```

**Features**:
- Sticky positioning (follows scroll)
- Clear price breakdown
- Auth check before checkout
- Free shipping indicator
- Responsive design

## 🎨 Styling & Responsive Design

### Mobile Layout

```typescript
// Stack vertically on mobile
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
  {/* Cart items take full width */}
  <div className="lg:col-span-2">
    <CartLineItems />
  </div>
  
  {/* Summary below items on mobile */}
  <div className="lg:col-span-1">
    <CartSummary />
  </div>
</div>
```

### Desktop Layout

```
┌─────────────────────────────┬──────────────┐
│                             │              │
│    Cart Line Items          │    Cart      │
│    (2 columns)              │   Summary    │
│                             │  (1 column)  │
│    Item 1                   │   Sticky     │
│    Item 2                   │              │
│    Item 3                   │              │
│                             │              │
└─────────────────────────────┴──────────────┘
```

## 🎯 User Interactions

### Add Item Animation

```typescript
// When item added, show toast
toast.success(
  <div className="flex items-center gap-2">
    <CheckCircle className="w-5 h-5" />
    <span>Added to cart</span>
  </div>
);

// Animate cart badge
<motion.span
  initial={{ scale: 1 }}
  animate={{ scale: [1, 1.2, 1] }}
  transition={{ duration: 0.3 }}
>
  {itemCount}
</motion.span>
```

### Remove Confirmation

```typescript
const handleRemove = () => {
  const confirmed = confirm(
    `Remove "${item.name}" from cart?`
  );
  
  if (confirmed) {
    removeItem(item.id);
    toast.success("Item removed from cart");
  }
};
```

### Loading States

```typescript
{isUpdating && (
  <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
    <Loader2 className="w-6 h-6 animate-spin" />
  </div>
)}
```

## 🔔 Cart Badge (Navbar)

**File**: `src/components/layout/navbar.tsx`

```typescript
function CartBadge() {
  const items = useCartStore((state) => state.items);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  return (
    <Link 
      href="/cart"
      className="relative p-2 hover:bg-gray-100 rounded-lg"
    >
      <ShoppingCart className="w-6 h-6" />
      
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </Link>
  );
}
```

## ♿ Accessibility

### Keyboard Navigation

```typescript
// Enter/Space to trigger actions
<button
  onClick={handleRemove}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleRemove();
    }
  }}
  aria-label={`Remove ${item.name} from cart`}
>
  <Trash2 />
</button>
```

### Screen Reader Support

```typescript
<div role="region" aria-label="Shopping cart">
  <h1 id="cart-heading">Shopping Cart</h1>
  <ul aria-labelledby="cart-heading">
    {items.map(item => (
      <li key={item.id} aria-label={`${item.name}, ${item.quantity} items`}>
        {/* Item content */}
      </li>
    ))}
  </ul>
</div>
```

## 🚀 Performance Tips

1. **Memoize Expensive Calculations**
```typescript
const lineTotal = useMemo(
  () => (item.salePrice || item.price) * item.quantity,
  [item]
);
```

2. **Debounce Quantity Updates**
```typescript
const debouncedUpdate = useMemo(
  () => debounce(onUpdateQuantity, 300),
  [onUpdateQuantity]
);
```

3. **Lazy Load Images**
```typescript
<Image
  src={item.thumbnail}
  loading="lazy"
  placeholder="blur"
/>
```

---

**Next**: [Cart API Integration](./CART_API.md) - Backend integration

**Last Updated**: December 2025

