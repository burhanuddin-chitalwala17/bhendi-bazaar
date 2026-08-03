# Payment Flow - Overview

Complete guide to the payment processing system using Razorpay integration.

## 📌 Quick Summary

The payment system handles secure online payments with:
- **Razorpay** payment gateway integration
- **Order creation** before payment
- **Payment verification** with signature check
- **Webhook handling** for async confirmations
- **Stock deduction** on successful payment
- **Order tracking** post-payment

## 🏗️ Payment Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  PAYMENT FLOW                             │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  1. CHECKOUT                                              │
│     User → Checkout Page                                  │
│     - Validates cart stock                                │
│     - Collects shipping address                           │
│     - Creates order (status: processing)                  │
│                                                           │
│  2. PAYMENT ORDER CREATION                                │
│     Client → POST /api/payments/create-order              │
│     Server → Razorpay API                                 │
│     - Creates Razorpay order                              │
│     - Returns order ID + key                              │
│                                                           │
│  3. PAYMENT MODAL                                         │
│     Client → Opens Razorpay Checkout                      │
│     User → Completes payment                              │
│     Razorpay → Returns payment details                    │
│                                                           │
│  4. PAYMENT VERIFICATION                                  │
│     Client → POST /api/payments/verify                    │
│     Server → Verifies signature                           │
│     - Updates order (paymentStatus: paid)                 │
│     - Deducts stock (atomic transaction)                  │
│     - Clears cart                                         │
│                                                           │
│  5. WEBHOOK (ASYNC BACKUP)                                │
│     Razorpay → POST /api/webhooks/razorpay                │
│     Server → Verifies webhook signature                   │
│     - Confirms payment status                             │
│     - Logs event                                          │
│                                                           │
│  6. ORDER CONFIRMATION                                    │
│     Client → Redirect to /order/[id]                      │
│     User → Views order details                            │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

## 📁 Key Files

### Frontend
| File | Purpose | Lines |
|------|---------|-------|
| `src/components/checkout/checkout-form.tsx` | Checkout form | ~564 |
| `src/components/checkout/checkout-summary.tsx` | Order summary | ~150 |
| `src/services/paymentGatewayService.ts` | Razorpay SDK wrapper | ~176 |
| `src/domain/payment.ts` | Payment types | ~50 |

### Backend
| File | Purpose | Lines |
|------|---------|-------|
| `src/app/api/payments/create-order/route.ts` | Create payment order | ~100 |
| `src/app/api/payments/verify/route.ts` | Verify payment | ~80 |
| `src/app/api/webhooks/razorpay/route.ts` | Webhook handler | ~65 |
| `src/server/services/paymentService.ts` | Payment logic | ~150 |
| `src/server/repositories/razorpayRepository.ts` | Razorpay API | ~168 |

## 🔄 Complete Payment Flow

### Step 1: Checkout Initiation

```typescript
// User clicks "Place Order" on checkout page
async function handleCheckout() {
  // Validate stock first
  const { available, issues } = await checkStockAvailability();
  if (!available) {
    toast.error(issues[0].message);
    return;
  }
  
  // Create order in database
  const order = await orderService.createOrder({
    items: cartItems,
    totals: cartTotals,
    address: shippingAddress,
    userId: session?.user?.id,
  });
  
  // Proceed to payment
  await processPayment(order);
}
```

### Step 2: Create Razorpay Order

```typescript
async function processPayment(order: Order) {
  try {
    // Create Razorpay order
    const paymentOrder = await paymentGatewayService.createPaymentOrder({
      amount: order.totals.total * 100, // Convert to paise
      currency: "INR",
      localOrderId: order.code,
      customer: {
        name: order.address.name,
        email: session?.user?.email,
        contact: order.address.phone,
      },
    });
    
    // Open Razorpay checkout modal
    await openRazorpayCheckout(paymentOrder, order);
  } catch (error) {
    console.error("Payment error:", error);
    toast.error("Failed to initialize payment");
  }
}
```

### Step 3: Razorpay Checkout Modal

```typescript
async function openRazorpayCheckout(paymentOrder, order) {
  await paymentGatewayService.openCheckout(paymentOrder, {
    onSuccess: async (response) => {
      // Payment successful
      await handlePaymentSuccess(response, order.id);
    },
    onFailure: async (error) => {
      // Payment failed
      await handlePaymentFailure(error, order.id);
    },
    onDismiss: () => {
      // User closed modal
      toast.info("Payment cancelled");
    },
  });
}
```

### Step 4: Payment Verification

```typescript
async function handlePaymentSuccess(response, orderId) {
  try {
    // Update order with payment details
    await orderService.updateOrder(orderId, {
      paymentStatus: "paid",
      paymentMethod: "razorpay",
      razorpayOrderId: response.razorpay_order_id,
      razorpayPaymentId: response.razorpay_payment_id,
      razorpaySignature: response.razorpay_signature,
    });
    
    // Clear cart
    cartStore.clear();
    
    // Redirect to order page
    router.push(`/order/${orderId}`);
    toast.success("Payment successful!");
  } catch (error) {
    console.error("Failed to update order:", error);
    toast.error("Payment succeeded but order update failed");
  }
}
```

### Step 5: Webhook Confirmation

```typescript
// POST /api/webhooks/razorpay
export async function POST(req: Request) {
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const rawBody = await req.text();
  
  // Verify webhook signature
  const verification = await paymentService.verifyWebhook(signature, rawBody);
  
  if (!verification.isValid) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  
  const { event } = verification;
  
  // Handle different event types
  switch (event.eventType) {
    case "payment.captured":
    case "payment.success":
      await handlePaymentCaptured(event);
      break;
      
    case "payment.failed":
      await handlePaymentFailed(event);
      break;
  }
  
  return Response.json({ received: true });
}
```

## 💳 Payment Gateway Service

**File**: `src/services/paymentGatewayService.ts`

### SDK Initialization

```typescript
class PaymentGatewayService {
  private sdkLoaded = false;
  
  async loadSDK(): Promise<void> {
    if (this.sdkLoaded) return;
    
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        this.sdkLoaded = true;
        resolve();
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }
  
  async openCheckout(
    paymentOrder: PaymentGatewayOrder,
    options: PaymentGatewayOptions
  ): Promise<void> {
    await this.loadSDK();
    
    const razorpayOptions = {
      key: paymentOrder.key,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      name: "Bhendi Bazaar",
      description: "Order Payment",
      order_id: paymentOrder.gatewayOrderId,
      handler: options.onSuccess,
      modal: {
        ondismiss: options.onDismiss || (() => {}),
      },
      theme: {
        color: "#0f766e", // Emerald-700
      },
    };
    
    const razorpay = new (window as any).Razorpay(razorpayOptions);
    razorpay.on("payment.failed", options.onFailure);
    razorpay.open();
  }
}

export const paymentGatewayService = new PaymentGatewayService();
```

## 🔐 Security Features

### 1. Signature Verification

```typescript
// Server-side verification
import crypto from "crypto";

function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET!;
  
  const payload = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  
  return expectedSignature === signature;
}
```

### 2. Webhook Verification

```typescript
function verifyWebhookSignature(
  signature: string,
  body: string
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
  
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  
  return expectedSignature === signature;
}
```

### 3. Amount Validation

```typescript
// Always validate amount on server
async function verifyOrderAmount(orderId: string, paidAmount: number) {
  const order = await getOrder(orderId);
  const expectedAmount = order.totals.total * 100; // Paise
  
  if (paidAmount !== expectedAmount) {
    throw new Error("Amount mismatch");
  }
}
```

## 🗄️ Database Updates

### Order Status Flow

```
1. Order Created:
   status: "processing"
   paymentStatus: "pending"

2. Payment Initiated:
   paymentMethod: "razorpay"
   razorpayOrderId: "order_xxx"

3. Payment Success:
   paymentStatus: "paid"
   razorpayPaymentId: "pay_xxx"
   razorpaySignature: "signature_xxx"

4. Stock Deducted:
   (Atomic transaction in orderRepository)

5. Webhook Confirms:
   (Log entry created)
```

## 🔁 Error Handling

### Payment Failures

```typescript
async function handlePaymentFailure(error: any, orderId: string) {
  try {
    // Update order status
    await orderService.updateOrder(orderId, {
      paymentStatus: "failed",
    });
    
    // Show error to user
    const errorMessage = error?.error?.description || "Payment failed";
    toast.error(errorMessage);
    
    // Allow retry
    setIsProcessing(false);
  } catch (updateError) {
    console.error("Failed to update order after payment failure:", updateError);
  }
}
```

### Network Issues

```typescript
try {
  const paymentOrder = await paymentGatewayService.createPaymentOrder(data);
} catch (error) {
  if (error instanceof TypeError) {
    toast.error("Network error. Please check your connection.");
  } else {
    toast.error("Failed to create payment order. Please try again.");
  }
}
```

## 📊 Payment Tracking

### Order Logs (Future Feature)

```typescript
interface PaymentLog {
  orderId: string;
  event: "initiated" | "success" | "failed" | "refunded";
  amount: number;
  gatewayOrderId?: string;
  paymentId?: string;
  errorMessage?: string;
  timestamp: Date;
}

// Track all payment events
await createPaymentLog({
  orderId: order.id,
  event: "success",
  amount: order.totals.total,
  gatewayOrderId: paymentOrder.gatewayOrderId,
  paymentId: response.razorpay_payment_id,
  timestamp: new Date(),
});
```

## 🧪 Testing Payments

### Test Mode Setup

```env
# Use test mode keys
RAZORPAY_KEY_ID="rzp_test_xxxxxx"
RAZORPAY_KEY_SECRET="xxxxx"
```

### Test Cards

Razorpay test cards:
- **Success**: 4111 1111 1111 1111
- **Failure**: 4111 1111 1111 1234
- **CVV**: Any 3 digits
- **Expiry**: Any future date

### Test Scenarios

1. **Successful Payment**:
   - Use test card
   - Complete payment
   - Verify order updated
   - Check stock deducted

2. **Failed Payment**:
   - Use failure test card
   - Verify order status = "failed"
   - Check stock not deducted

3. **User Cancellation**:
   - Close payment modal
   - Verify order remains "processing"
   - Allow retry

## 🔗 Related Documentation

- [Checkout Process](../client-side/checkout/README.md) - User checkout flow
- [Order Management](../client-side/orders/README.md) - Order tracking
- [Razorpay Integration](../../integrations/RAZORPAY.md) - Detailed Razorpay setup

---

**Last Updated**: December 2025  
**Maintained By**: Bhendi Bazaar Development Team

