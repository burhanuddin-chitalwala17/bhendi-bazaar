# Architecture Overview - Bhendi Bazaar

This document provides a comprehensive overview of the Bhendi Bazaar system architecture, design patterns, and technical decisions.

## 🏗️ High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐           ┌──────────────────┐         │
│  │  User Interface  │           │   Admin Panel    │         │
│  │   (Next.js UI)   │           │   (Next.js UI)   │         │
│  │                  │           │                  │         │
│  │ • Home           │           │ • Dashboard      │         │
│  │ • Products       │           │ • Products Mgmt  │         │
│  │ • Cart           │           │ • Orders Mgmt    │         │
│  │ • Checkout       │           │ • Users Mgmt     │         │
│  │ • Profile        │           │ • Cart Mgmt      |         |
|  | • Orders/Order   |           | • Review Mgmt    │         │
│  └────────┬─────────┘           └────────┬─────────┘         │
│           │                              │                   │
│           └──────────────┬───────────────┘                   │
│                          │                                   │
│              ┌───────────▼──────────┐                        │
│              │  Client Services     │                        │
│              │  (API Abstraction)   │                        │
│              └───────────┬──────────┘                        │
└──────────────────────────┼───────────────────────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │      STATE MANAGEMENT LAYER          │
        ├──────────────────────────────────────┤
        │  • Zustand (Cart Store)             │
        │  • NextAuth Session (Auth State)    │
        │  • React Server Components (Cache)  │
        └──────────────────┬──────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    MIDDLEWARE LAYER                           │
├───────────────────────────────────────────────────────────────┤
│  • Route Protection (Admin routes)                           │
│  • JWT Token Validation                                      │
│  • Authentication Checks                                     │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                      API LAYER (Next.js Routes)              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   Public    │  │    Admin    │  │   Webhooks  │           │
│  │   Routes    │  │    Routes   │  │             │           │
│  │             │  │             │  │             │           │
│  │ /api/       │  │ /api/admin/ │  │ /api/       │           │
│  │ products    │  │ dashboard   │  │ webhooks/   │           │
│  │ orders      │  │ products    │  │ razorpay    │           │
│  │ cart        │  │ users       │  │             │           │
│  │ auth        │  │ orders      │  │             │           │
│  │ payments    │  │ reviews     │  │             │           │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                   SERVICE LAYER                              │
├──────────────────────────────────────────────────────────────┤
│  Business Logic & Orchestration                              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Product    │  │    Order     │  │    Cart      │        │
│  │   Service    │  │   Service    │  │   Service    │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                 │                 │                │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐        │
│  │   Payment    │  │   Profile    │  │   Category   │        │
│  │   Service    │  │   Service    │  │   Service    │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                  REPOSITORY LAYER                            │
├──────────────────────────────────────────────────────────────┤
│  Database Access & Data Mapping                              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Product    │  │    Order     │  │    Cart      │        │
│  │  Repository  │  │  Repository  │  │  Repository  │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                 │                 │                │
│  ┌──────▼────────┐ ┌──────▼────────┐ ┌──────▼───────┐        │
│  │  Razorpay     │ │   Profile     │ │   Category   │        │
│  │  Repository   │ │  Repository   │ │  Repository  │        │
│  └──────┬────────┘ └──────┬────────┘ └──────┬───────┘        │
│         │                 │                  │               │
│         └─────────────────┼──────────────────┘               │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                   DATA LAYER                                  │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────┐          │
│  │          Prisma ORM (Type-Safe)                │          │
│  └────────────────┬───────────────────────────────┘          │
│                   │                                           │
│  ┌────────────────▼───────────────────────────────┐          │
│  │          PostgreSQL Database                   │          │
│  │                                                 │          │
│  │  Models:                                        │          │
│  │  • User          • Product      • Order        │          │
│  │  • Category      • Review       • Cart         │          │
│  │  • Profile       • AdminLog     • Session      │          │
│  │  • Account       • VerificationToken           │          │
│  └─────────────────────────────────────────────────┘          │
│                                                               │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES                            │
├───────────────────────────────────────────────────────────────┤
│  • Razorpay (Payment Gateway)                                │
│  • Google OAuth (Authentication)                             │
│  • Vercel Blob Storage (Image Storage)                       │
│  • NextAuth.js (Session Management)                          │
└───────────────────────────────────────────────────────────────┘
```

## 🎯 Design Patterns

### 1. Repository-Service Pattern

**Purpose**: Separation of concerns between data access and business logic

```typescript
// Flow: Component → Service → Repository → Database

// Repository Layer (Data Access)
class ProductRepository {
  async findBySlug(slug: string): Promise<Product> {
    return await prisma.product.findUnique({ where: { slug } });
  }
}

// Service Layer (Business Logic)
class ProductService {
  async getProductDetails(slug: string) {
    const product = await productRepository.findBySlug(slug);
    // Business logic: calculate discounts, format data, etc.
    return transformedProduct;
  }
}

// API Route (HTTP Handler)
export async function GET(req: Request) {
  const product = await productService.getProductDetails(slug);
  return Response.json(product);
}
```

**Benefits**:
- Clear separation of concerns
- Easier testing and mocking
- Reusable business logic
- Database abstraction

### 2. Domain-Driven Design

**Purpose**: Type safety and clear boundaries between layers

```
src/domain/           → Client-facing types (what UI sees)
src/server/domain/    → Server-side types (internal representation)
```

**Example**:
```typescript
// Client domain type
interface Product {
  id: string;
  name: string;
  price: number;
  // Only what client needs
}

// Server domain type
interface ServerProduct extends Product {
  lowStockThreshold: number;
  categoryId: string;
  // Internal fields
}
```

### 3. Service Layer Pattern (Client)

**Purpose**: Abstract API calls from UI components

```typescript
// Instead of fetch in components
const ProductService = {
  async getProducts() {
    return fetch('/api/products').then(r => r.json());
  }
};

// Components use service
const products = await productService.getProducts();
```

### 4. Factory Pattern

**Purpose**: Create complex objects with consistent structure

Used in:
- Order creation with automatic order code generation
- Cart item creation with unique IDs
- Payment order creation

## 🔄 Data Flow Patterns

### User Action Flow (Example: Add to Cart)

```
1. User clicks "Add to Cart"
   ↓
2. Component calls cartStore.addItem()
   ↓
3. Zustand updates state (localStorage)
   ↓
4. useCartSync hook detects change
   ↓
5. Debounced sync to server (if authenticated)
   ↓
6. POST /api/cart → cartService.updateCart()
   ↓
7. cartRepository.upsert() → Prisma → Database
   ↓
8. Success response → UI update
```

### Order Creation Flow

```
1. User submits checkout form
   ↓
2. Validate cart stock availability
   ↓
3. Create order (status: processing)
   ↓
4. Create Razorpay payment order
   ↓
5. Open Razorpay checkout modal
   ↓
6. User completes payment
   ↓
7. Razorpay callback → Verify signature
   ↓
8. Update order (paymentStatus: paid)
   ↓
9. Webhook confirmation (backup)
   ↓
10. Stock decrement (atomic transaction)
    ↓
11. Clear cart & redirect to order page
```

### Admin Update Flow

```
1. Admin updates product
   ↓
2. Admin route protected by middleware
   ↓
3. POST /api/admin/products/[id]
   ↓
4. Verify admin role in API route
   ↓
5. adminProductService.updateProduct()
   ↓
6. adminProductRepository.update()
   ↓
7. Create admin log entry
   ↓
8. Prisma transaction → Database
   ↓
9. Success response + cache revalidation
```

## 🔐 Security Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────┐
│         User Authentication                  │
├─────────────────────────────────────────────┤
│                                             │
│  1. Login Options:                          │
│     • Google OAuth                          │
│     • Email/Password (Credentials)          │
│                                             │
│  2. NextAuth.js Handles:                    │
│     • Token generation (JWT)                │
│     • Session management                    │
│     • Cookie handling                       │
│                                             │
│  3. JWT Token Contains:                     │
│     • User ID                               │
│     • User role (USER/ADMIN)                │
│     • Expiration time                       │
│                                             │
│  4. Middleware Protection:                  │
│     • Check token validity                  │
│     • Verify admin role for /admin routes   │
│     • Redirect unauthorized users           │
│                                             │
└─────────────────────────────────────────────┘
```

### Authorization Levels

| Route Pattern | Access Level | Protection |
|--------------|--------------|------------|
| `/` | Public | None |
| `/product/*` | Public | None |
| `/cart` | Public | None |
| `/checkout` | Authenticated | Session check |
| `/profile` | Authenticated | Session check |
| `/orders` | Authenticated | Session check |
| `/admin/*` | Admin only | Middleware + role check |
| `/api/admin/*` | Admin only | Role verification |

## 📊 State Management Architecture

### Multi-Layer State Strategy

```
┌─────────────────────────────────────────────┐
│           STATE LAYERS                      │
├─────────────────────────────────────────────┤
│                                             │
│  1. Server State (Cache)                    │
│     • React Server Components               │
│     • Automatic caching                     │
│     • Revalidation strategies               │
│                                             │
│  2. Client Global State (Zustand)           │
│     • Shopping cart                         │
│     • Persisted to localStorage             │
│     • Synced to server when authenticated   │
│                                             │
│  3. Session State (NextAuth)                │
│     • User authentication                   │
│     • JWT token                             │
│     • User profile data                     │
│                                             │
│  4. Component State (React)                 │
│     • Form inputs                           │
│     • UI toggles                            │
│     • Local interactions                    │
│                                             │
└─────────────────────────────────────────────┘
```

### Cart State Synchronization

```
Guest User:
  Cart → localStorage only

Authenticated User:
  Cart → localStorage + Server Database
  
  Login event:
    1. Load server cart
    2. Merge with local cart
    3. Update server with merged cart
    
  Cart change:
    1. Update localStorage immediately
    2. Debounce (1s) → Sync to server
    3. Background sync (no blocking)
```

## 🏛️ Database Architecture

### Entity Relationships

```
User ────┬──── Profile (1:1)
         ├──── Cart (1:1)
         ├──── Orders (1:Many)
         ├──── Reviews (1:Many)
         ├──── AdminLogs (1:Many, if admin)
         ├──── Accounts (1:Many, OAuth)
         └──── Sessions (1:Many)

Category ──── Products (1:Many)

Product ───── Reviews (1:Many)

Order ──────── User (Many:1, nullable for guest)
```

### Indexing Strategy

**Purpose**: Optimize query performance

| Model | Indexed Fields | Reason |
|-------|---------------|--------|
| User | email, mobile, role, isBlocked | Fast auth & user lookup |
| Product | slug, categoryId, isFeatured, stock | Product queries & filtering |
| Order | code, userId, status, createdAt | Order tracking & admin queries |
| Review | productId, userId, rating, isApproved | Review queries & filtering |
| Category | slug, order | Category navigation |

## 🚀 Performance Architecture

### Rendering Strategy

```
┌─────────────────────────────────────────────┐
│        Next.js Rendering Patterns           │
├─────────────────────────────────────────────┤
│                                             │
│  Server Components (Default):               │
│    • Homepage                               │
│    • Product pages                          │
│    • Category pages                         │
│    • Order details                          │
│    Benefits: SEO, fast initial load         │
│                                             │
│  Client Components:                         │
│    • Shopping cart                          │
│    • Checkout form                          │
│    • Admin dashboard                        │
│    • Interactive UI elements                │
│    Benefits: Interactivity, real-time       │
│                                             │
│  Hybrid Approach:                           │
│    Server component with embedded client    │
│    Example: Product page with "Add to Cart" │
│                                             │
└─────────────────────────────────────────────┘
```

### Caching Strategy

1. **React Server Component Cache**
   - Automatic during build
   - Revalidation on demand

2. **Database Query Caching**
   - Prisma query caching
   - Connection pooling

3. **API Response Caching**
   - HTTP cache headers
   - CDN edge caching (Vercel)

4. **Static Generation**
   - Product pages (ISR)
   - Category pages (ISR)

## 🔌 Integration Architecture

### Payment Integration (Razorpay)

```
Client                Server              Razorpay
  │                     │                    │
  │ 1. Create Order     │                    │
  ├────────────────────>│                    │
  │                     │ 2. Create Payment  │
  │                     │    Order           │
  │                     ├───────────────────>│
  │                     │ 3. Order ID        │
  │                     │<───────────────────┤
  │ 4. Order Details    │                    │
  │<────────────────────┤                    │
  │                     │                    │
  │ 5. Open Checkout    │                    │
  │────────────────────────────────────────> │
  │                     │                    │
  │ 6. Payment Success  │                    │
  │<──────────────────────────────────────── ┤
  │                     │                    │
  │ 7. Update Order     │                    │
  ├────────────────────>│                    │
  │                     │ 8. Webhook (async) │
  │                     │<───────────────────┤
  │                     │ 9. Verify & Log    │
  │                     │                    │
```

### Authentication Integration (NextAuth)

```
User → NextAuth → Provider (Google/Credentials)
                     ↓
                 Callback
                     ↓
              Create Session (JWT)
                     ↓
              Store in Cookie
                     ↓
           Available in Middleware & API
```

## 📁 File Structure Architecture

```
src/
├── app/                 # Next.js App Router
│   ├── (main)/         # User-facing routes
│   ├── (admin)/        # Admin panel routes
│   ├── (auth)/         # Auth pages (signin/signup)
│   └── api/            # API routes
│
├── components/         # React components
│   ├── admin/         # Admin-specific components
│   ├── ui/            # Shadcn UI components
│   └── [feature]/     # Feature-specific components
│
├── domain/            # Client-facing types
│
├── server/            # Server-side code
│   ├── domain/       # Server types
│   ├── repositories/ # Data access layer
│   └── services/     # Business logic layer
│
├── services/         # Client-side API services
│
├── lib/             # Shared utilities
│
├── hooks/           # React hooks
│
├── store/           # Zustand stores
│
└── types/           # TypeScript type definitions
```

## 🔄 Deployment Architecture

```
┌─────────────────────────────────────────────┐
│          Production Deployment              │
├─────────────────────────────────────────────┤
│                                             │
│  Vercel Platform                            │
│  ├── Edge Network (CDN)                     │
│  ├── Serverless Functions (API Routes)     │
│  ├── Build Cache                            │
│  └── Environment Variables                  │
│                                             │
│  Database (PostgreSQL)                      │
│  ├── Vercel Postgres / Supabase            │
│  ├── Connection Pooling                     │
│  └── Automatic Backups                      │
│                                             │
│  Storage (Vercel Blob)                      │
│  ├── Image CDN                              │
│  └── Global Distribution                    │
│                                             │
│  External Services                          │
│  ├── Razorpay API                           │
│  └── Google OAuth                           │
│                                             │
└─────────────────────────────────────────────┘
```

## 🎯 Architecture Decisions

### Why Next.js App Router?
- Server components for better performance
- Built-in routing and layouts
- API routes co-located with frontend
- Excellent TypeScript support

### Why Prisma?
- Type-safe database queries
- Schema-first approach
- Excellent migration system
- Auto-generated types

### Why Zustand?
- Lightweight (1KB)
- Simple API
- Built-in persistence
- No boilerplate

### Why Repository-Service Pattern?
- Testability
- Separation of concerns
- Easier to maintain
- Database agnostic

### Why JWT over Session?
- Stateless authentication
- Better scalability
- Works with serverless
- Lower database load

---

**Last Updated**: December 2025  
**Maintained By**: Bhendi Bazaar Development Team


