# Shipping Module

Complete shipping management system with multi-provider support, rate shopping, caching, and smart provider selection.

## 📦 Features

- ✅ **Multi-Provider Support** - Use multiple shipping providers simultaneously
- ✅ **Smart Rate Shopping** - Compare rates across providers automatically
- ✅ **Flexible Provider Selection** - Multiple strategies (cheapest, fastest, balanced, etc.)
- ✅ **Automatic Fallback** - If one provider fails, try another
- ✅ **Intelligent Caching** - Cache shipping rates to reduce API calls
- ✅ **Event Logging** - Complete audit trail of all shipping operations
- ✅ **Webhook Support** - Handle real-time updates from providers
- ✅ **Type-Safe** - Full TypeScript support

## 🏗️ Architecture

```
shipping/
├── domain/              # Types & interfaces
├── services/            # Business logic
├── repositories/        # Database access
├── providers/           # Provider implementations
└── utils/              # Helper functions
```

## 🚀 Quick Start

### 1. Initialize Module

```typescript
import { initializeShippingModule } from '@/server/shipping';
import { PROVIDER_FACTORIES } from '@/server/shipping/providers';

// Call once at application startup
await initializeShippingModule(PROVIDER_FACTORIES);
```

### 2. Get Shipping Rates

```typescript
import { shippingOrchestrator } from '@/server/shipping';

const rates = await shippingOrchestrator.getRatesFromAllProviders({
  fromPincode: '110001',
  toPincode: '400001',
  package: {
    weight: 2.5,
    declaredValue: 1000,
  },
  mode: 'prepaid',
});
```

### 3. Select Best Rate

```typescript
const result = await shippingOrchestrator.getBestRate(request, {
  strategy: 'balanced',  // or 'cheapest', 'fastest', 'priority'
  maxCost: 150,
  maxDays: 5,
});

const selectedRate = result?.selectedRate;
```

### 4. Create Shipment

```typescript
const shipment = await shippingOrchestrator.createShipmentWithFallback({
  orderId: 'order_123',
  orderCode: 'BB-1001',
  fromAddress: warehouseAddress,
  toAddress: customerAddress,
  package: packageDetails,
  mode: 'prepaid',
  selectedRate: selectedRate,
});

// Use shipment.trackingNumber, shipment.trackingUrl, etc.
```

### 5. Track Shipment

```typescript
const tracking = await shippingOrchestrator.trackShipment(
  trackingNumber,
  providerId
);

console.log(tracking.currentStatus);
console.log(tracking.history);
```

## 📋 Provider Selection Strategies

### Cheapest
```typescript
{ strategy: 'cheapest' }
// Selects provider with lowest shipping cost
```

### Fastest
```typescript
{ strategy: 'fastest' }
// Selects provider with shortest delivery time
```

### Balanced
```typescript
{
  strategy: 'balanced',
  balancedWeights: {
    costWeight: 0.6,    // 60% weight on cost
    speedWeight: 0.4,   // 40% weight on speed
  }
}
// Best cost-time ratio
```

### Priority
```typescript
{
  strategy: 'priority',
  preferredProviders: ['shiprocket', 'delhivery']
}
// Uses provider priority from database
```

### Specific
```typescript
{
  strategy: 'specific',
  specificProviderId: 'provider_id_123'
}
// Use a specific provider
```

### Custom
```typescript
{
  strategy: 'custom',
  customSelector: (rates) => {
    // Your custom logic
    return rates[0];
  }
}
```

## 🔧 Adding a New Provider

### 1. Create Provider Implementation

```typescript
// providers/myprovider/myprovider.provider.ts
import { BaseShippingProvider } from '../base.provider';

export class MyProvider extends BaseShippingProvider {
  getProviderId() { return 'myprovider'; }
  getProviderName() { return 'My Provider'; }
  
  async checkServiceability(pincode: string): Promise<boolean> {
    // Implementation
  }
  
  async getRates(request: ShippingRateRequest): Promise<ShippingRate[]> {
    // Implementation
  }
  
  async createShipment(request: CreateShipmentRequest): Promise<Shipment> {
    // Implementation
  }
  
  async trackShipment(trackingNumber: string): Promise<TrackingInfo> {
    // Implementation
  }
  
  async cancelShipment(trackingNumber: string): Promise<boolean> {
    // Implementation
  }
  
  async handleWebhook(payload: any): Promise<WebhookEvent> {
    // Implementation
  }
}
```

### 2. Register Provider

```typescript
// providers/index.ts
import { MyProvider } from './myprovider/myprovider.provider';

export const PROVIDER_FACTORIES = {
  myprovider: (config) => new MyProvider(),
  // ... other providers
};
```

### 3. Add to Database

```typescript
await prisma.shippingProvider.create({
  data: {
    code: 'myprovider',
    name: 'My Provider',
    isEnabled: true,
    priority: 100,
    supportedModes: ['prepaid', 'cod'],
    config: {
      apiKey: 'your_api_key',
      // ... other config
    },
  },
});
```

## 🗄️ Database Models

### ShippingProvider
Stores provider configuration and credentials.

### ShippingRateCache
Caches shipping rates to reduce API calls.

### ShippingEvent
Logs all shipping events for debugging and analytics.

## 📊 Services

### ShippingOrchestratorService
Main service that coordinates all operations.

### ProviderSelectorService
Implements smart provider selection strategies.

### ShippingCacheService
Manages rate caching with TTL.

## 🛠️ Utilities

### Status Normalizer
Maps provider-specific statuses to common format.

### Validators
Validates pincodes, phone numbers, etc.

### Weight Calculator
Calculates package weight and volumetric weight.

## 📡 API Integration Example

```typescript
// app/api/shipping/rates/route.ts
import { shippingOrchestrator } from '@/server/shipping';

export async function POST(request: Request) {
  const body = await request.json();
  
  const rates = await shippingOrchestrator.getRatesFromAllProviders({
    fromPincode: '110001',
    toPincode: body.pincode,
    package: { weight: body.weight, declaredValue: body.amount },
    mode: body.mode,
  });
  
  return Response.json({ rates });
}
```

## 🔐 Security

- Provider credentials stored in database (encrypted in production)
- Webhook signature validation supported
- Rate limiting on API calls
- Event logging for audit trails

## 📈 Performance

- **Caching**: Rates cached for 24 hours (configurable)
- **Parallel Requests**: Get rates from multiple providers simultaneously
- **Fallback**: Automatic failover if provider fails
- **Adaptive TTL**: Shorter cache for popular routes

## 🧪 Testing

```typescript
// Mock provider for testing
class MockProvider extends BaseShippingProvider {
  // ... implementation
}

// Use in tests
const orchestrator = new ShippingOrchestratorService();
await orchestrator.loadProviders({
  mock: () => new MockProvider(),
});
```

## 📝 Logging

All operations are logged to `ShippingEvent` table:
- Rate checks
- Shipment creation
- Status updates
- Webhook events
- Errors and failures

Query logs for debugging:
```typescript
import { shippingEventRepository } from '@/server/shipping';

const events = await shippingEventRepository.getByOrderId('order_123');
const failedEvents = await shippingEventRepository.getFailedEvents();
```

## 🔄 Cache Management

```typescript
import { shippingCacheService } from '@/server/shipping';

// Clear expired cache
await shippingCacheService.cleanExpiredCache();

// Clear provider cache
await shippingCacheService.clearProviderCache('provider_id');

// Clear all cache
await shippingCacheService.clearAllCache();
```

## 🎯 Best Practices

1. **Always use caching** - Reduces API costs
2. **Implement webhooks** - For real-time status updates
3. **Use fallback providers** - Ensures shipment creation success
4. **Log all events** - Essential for debugging
5. **Validate pincodes** - Before calling provider APIs
6. **Handle errors gracefully** - Show user-friendly messages
