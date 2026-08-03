# Database Schema Overview - Bhendi Bazaar

This document provides comprehensive documentation of the Bhendi Bazaar database schema, including all models, relationships, and design decisions.

## 📊 Database Technology

- **Database**: PostgreSQL (v14+)
- **ORM**: Prisma (v7.1.0)
- **Schema Location**: `prisma/schema.prisma`
- **Migration History**: `prisma/migrations/`

## 🏗️ Schema Overview

The database consists of **13 models** organized into these functional groups:

1. **Authentication & Users** (5 models)
2. **E-Commerce Core** (4 models)
3. **Admin & Logging** (1 model)
4. **Supporting Models** (3 models)

## 📐 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATION GROUP                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User ───────┬──────> Profile (1:1)                            │
│  (Core)      ├──────> Cart (1:1)                               │
│              ├──────> Order (1:Many, nullable)                  │
│              ├──────> Review (1:Many, nullable)                 │
│              ├──────> AdminLog (1:Many)                         │
│              ├──────> Account (1:Many, OAuth)                   │
│              └──────> Session (1:Many)                          │
│                                                                  │
│  VerificationToken (Standalone for email verification)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     E-COMMERCE CORE GROUP                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Category ────────> Product (1:Many)                            │
│                         │                                        │
│                         └──────> Review (1:Many)                │
│                                                                  │
│  Cart (JSON field: items)                                       │
│  Order (JSON fields: items, totals, address)                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      ADMIN GROUP                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  AdminLog ────────> User (Many:1)                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 Model Details

### 1. User Model

**Purpose**: Core user authentication and profile management

```prisma
model User {
  id           String     @id @default(cuid())
  name         String?
  email        String?    @unique
  mobile       String?    @unique
  passwordHash String?
  role         String     @default("USER")
  isBlocked    Boolean    @default(false)
  lastActiveAt DateTime   @default(now())
  profile      Profile?
  cart         Cart?
  orders       Order[]
  reviews      Review[]
  adminLogs    AdminLog[]
  accounts     Account[]
  sessions     Session[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}
```

**Field Descriptions**:
| Field | Type | Purpose | Notes |
|-------|------|---------|-------|
| `id` | String (CUID) | Primary key | Auto-generated unique identifier |
| `name` | String? | User's display name | Optional for OAuth users |
| `email` | String? | Email address | Unique, optional (mobile auth) |
| `mobile` | String? | Mobile number | Unique, optional (email auth) |
| `passwordHash` | String? | Hashed password | Null for OAuth users |
| `role` | String | User role | Values: "USER", "ADMIN" |
| `isBlocked` | Boolean | Account status | Admin can block users |
| `lastActiveAt` | DateTime | Last activity | Updated on login |
| `createdAt` | DateTime | Registration date | Auto-set |
| `updatedAt` | DateTime | Last update | Auto-updated |

**Indexes**:
- `role` - Fast role-based queries
- `isBlocked` - Filter blocked users
- `lastActiveAt` - Activity tracking

**Design Decisions**:
- Email and mobile both optional to support different auth methods
- `passwordHash` nullable for OAuth-only users
- Soft delete approach with `isBlocked` instead of hard delete
- CUID for IDs (better than UUID for database performance)

---

### 2. Profile Model

**Purpose**: Extended user information separate from authentication

```prisma
model Profile {
  id         String  @id @default(cuid())
  user       User    @relation(fields: [userId], references: [id])
  userId     String  @unique
  addresses  Json?   // Array of address objects
  profilePic String? // URL to profile image
}
```

**Field Descriptions**:
| Field | Type | Purpose | Notes |
|-------|------|---------|-------|
| `userId` | String | Foreign key to User | One-to-one relationship |
| `addresses` | JSON | Saved addresses | Flexible schema for address data |
| `profilePic` | String? | Avatar URL | Vercel Blob Storage URL |

**JSON Structure for `addresses`**:
```typescript
interface Address {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

// Stored as: Address[]
```

**Design Decisions**:
- Separate table for better normalization
- JSON for addresses (flexible, no strict limit on address count)
- Profile created on-demand (not automatically with User)

---

### 3. Category Model

**Purpose**: Product categorization and organization

```prisma
model Category {
  id               String    @id @default(cuid())
  slug             String    @unique
  name             String
  description      String    @db.Text
  heroImage        String
  accentColorClass String
  order            Int       @default(0)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  products         Product[]
}
```

**Field Descriptions**:
| Field | Type | Purpose | Notes |
|-------|------|---------|-------|
| `slug` | String | URL-friendly identifier | Unique, used in routes |
| `name` | String | Display name | E.g., "Men's Clothing" |
| `description` | Text | Category description | Full text description |
| `heroImage` | String | Banner image URL | Category page hero |
| `accentColorClass` | String | Tailwind color class | E.g., "bg-emerald-100" |
| `order` | Int | Display order | Lower = appears first |

**Indexes**:
- `slug` - Fast URL-based lookups
- `order` - Sorted category lists

**Design Decisions**:
- Slug for SEO-friendly URLs
- Order field for manual sorting
- Color class for consistent theming
- Text type for long descriptions

---

### 4. Product Model

**Purpose**: Product catalog with inventory management

```prisma
model Product {
  id                String   @id @default(cuid())
  slug              String   @unique
  name              String
  description       String   @db.Text
  price             Float
  salePrice         Float?
  currency          String   @default("INR")
  categoryId        String
  category          Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  tags              String[]
  isFeatured        Boolean  @default(false)
  isHero            Boolean  @default(false)
  isOnOffer         Boolean  @default(false)
  rating            Float    @default(0)
  reviewsCount      Int      @default(0)
  images            String[]
  thumbnail         String
  sizes             String[]
  colors            String[]
  stock             Int      @default(0)
  sku               String?  @unique
  lowStockThreshold Int      @default(10)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  reviews           Review[]
}
```

**Field Descriptions**:
| Field | Type | Purpose | Notes |
|-------|------|---------|-------|
| `slug` | String | URL identifier | Unique, SEO-friendly |
| `price` | Float | Regular price | In minor units (e.g., 999.00) |
| `salePrice` | Float? | Discounted price | Null if no discount |
| `categoryId` | String | Category foreign key | Cascade delete |
| `tags` | String[] | Search tags | Array for flexible tagging |
| `isFeatured` | Boolean | Featured flag | Homepage display |
| `isHero` | Boolean | Hero product flag | Main hero section |
| `isOnOffer` | Boolean | Special offer flag | Offers page |
| `rating` | Float | Average rating | Calculated from reviews |
| `reviewsCount` | Int | Total reviews | Denormalized for performance |
| `images` | String[] | Product images | Array of URLs |
| `thumbnail` | String | Main image | Used in cards/lists |
| `sizes` | String[] | Available sizes | E.g., ["S", "M", "L"] |
| `colors` | String[] | Available colors | E.g., ["Red", "Blue"] |
| `stock` | Int | Inventory count | Real-time stock |
| `sku` | String? | Stock Keeping Unit | Optional, unique |
| `lowStockThreshold` | Int | Alert threshold | Default 10 |

**Indexes**:
- `slug` - Product page lookups
- `categoryId` - Category filtering
- `isFeatured` - Featured products query
- `isHero` - Hero products query
- `isOnOffer` - Offers page query
- `createdAt` - "New arrivals" sorting
- `stock` - Low stock alerts

**Design Decisions**:
- Arrays for images, sizes, colors (flexible, no joins)
- Denormalized rating and reviewsCount (performance)
- Cascade delete from category (maintain integrity)
- SKU optional (not all products need it)
- Currency field (future multi-currency support)

---

### 5. Review Model

**Purpose**: Product reviews and ratings

```prisma
model Review {
  id         String   @id @default(cuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  userId     String?
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  rating     Int      // 1-5
  title      String?
  comment    String?  @db.Text
  userName   String
  isVerified Boolean  @default(false)
  isApproved Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Field Descriptions**:
| Field | Type | Purpose | Notes |
|-------|------|---------|-------|
| `productId` | String | Product foreign key | Cascade delete |
| `userId` | String? | User foreign key | Nullable (SetNull on delete) |
| `rating` | Int | Star rating | 1-5 scale |
| `title` | String? | Review headline | Optional |
| `comment` | Text? | Review text | Optional, can be long |
| `userName` | String | Display name | Stored separately (user may delete account) |
| `isVerified` | Boolean | Verified purchase | True if user bought product |
| `isApproved` | Boolean | Moderation status | Admin can hide reviews |

**Indexes**:
- `productId` - Product reviews query
- `userId` - User reviews query
- `rating` - Rating filtering
- `createdAt` - Recent reviews
- `isApproved` - Filter unapproved reviews

**Design Decisions**:
- `userName` stored separately (persist even if user deleted)
- `userId` nullable with SetNull (keep reviews after user deletion)
- Cascade delete from product (no orphan reviews)
- Default approved (trust users, moderate later)
- Verified purchase tracking

---

### 6. Cart Model

**Purpose**: Persistent shopping cart for authenticated users

```prisma
model Cart {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  items     Json     // CartItem[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Field Descriptions**:
| Field | Type | Purpose | Notes |
|-------|------|---------|-------|
| `userId` | String | User foreign key | One-to-one, unique |
| `items` | JSON | Cart items | Flexible schema |

**JSON Structure for `items`**:
```typescript
interface CartItem {
  id: string;
  productId: string;
  name: string;
  thumbnail: string;
  price: number;
  salePrice?: number;
  quantity: number;
  size?: string;
  color?: string;
}

// Stored as: CartItem[]
```

**Design Decisions**:
- JSON for flexibility (no rigid schema)
- One cart per user (unique constraint)
- Cascade delete (remove cart when user deleted)
- Stores denormalized product data (price, name) for consistency
- Guest carts stored in localStorage (client-side only)

---

### 7. Order Model

**Purpose**: Order management and tracking

```prisma
model Order {
  id                String    @id @default(cuid())
  code              String    @unique
  userId            String?
  user              User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  items             Json      // CartItem[]
  totals            Json      // CartTotals
  status            String    @default("processing")
  address           Json      // OrderAddress
  notes             String?   @db.Text
  paymentMethod     String?
  paymentStatus     String?   @default("pending")
  paymentId         String?
  estimatedDelivery DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

**Field Descriptions**:
| Field | Type | Purpose | Notes |
|-------|------|---------|-------|
| `code` | String | Order number | Unique, e.g., "BB-1001" |
| `userId` | String? | User foreign key | Nullable for guest checkout |
| `items` | JSON | Order items | Snapshot at order time |
| `totals` | JSON | Price breakdown | Subtotal, discount, total |
| `status` | String | Order status | processing/packed/shipped/delivered |
| `address` | JSON | Delivery address | Full address object |
| `notes` | Text? | Special instructions | Customer notes |
| `paymentMethod` | String? | Payment method | "razorpay", etc. |
| `paymentStatus` | String | Payment status | pending/paid/failed |
| `paymentId` | String? | Gateway payment ID | Razorpay payment ID |
| `estimatedDelivery` | DateTime? | Delivery estimate | Calculated at order time |

**JSON Structures**:
```typescript
// items: CartItem[] (same as Cart)

// totals
interface CartTotals {
  subtotal: number;
  discount: number;
  total: number;
}

// address
interface OrderAddress {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
}
```

**Indexes**:
- `userId` - User orders query
- `code` - Order lookup by code
- `createdAt` - Recent orders
- `status` - Status filtering
- `paymentStatus` - Payment status filtering

**Design Decisions**:
- `code` for human-friendly order numbers
- `userId` nullable (guest checkout support)
- SetNull on user delete (keep order history)
- JSON for items (snapshot, doesn't change if product updated)
- Separate payment status (order can exist before payment)
- Auto-generated estimated delivery

---

### 8. AdminLog Model

**Purpose**: Audit trail for admin actions

```prisma
model AdminLog {
  id         String   @id @default(cuid())
  adminId    String
  admin      User     @relation(fields: [adminId], references: [id], onDelete: Cascade)
  action     String
  resource   String
  resourceId String
  metadata   Json?
  createdAt  DateTime @default(now())
}
```

**Field Descriptions**:
| Field | Type | Purpose | Notes |
|-------|------|---------|-------|
| `adminId` | String | Admin user ID | Foreign key to User |
| `action` | String | Action type | E.g., "USER_BLOCKED" |
| `resource` | String | Resource type | E.g., "User", "Product" |
| `resourceId` | String | Affected resource ID | ID of modified entity |
| `metadata` | JSON? | Additional details | Flexible context data |

**Indexes**:
- `adminId` - Admin activity query
- `createdAt` - Recent activity
- `resource` - Filter by resource type
- `action` - Filter by action type

**Design Decisions**:
- Immutable (no updates, only inserts)
- Cascade delete (remove logs if admin deleted)
- Flexible metadata for context
- No updates field (audit logs shouldn't change)

---

### 9-13. NextAuth Models

These models are managed by NextAuth.js:

#### Account
```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id])
  
  @@unique([provider, providerAccountId])
}
```

**Purpose**: OAuth provider accounts (Google, etc.)

#### Session
```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id])
}
```

**Purpose**: Active user sessions (if using database sessions)

#### VerificationToken
```prisma
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  
  @@unique([identifier, token])
}
```

**Purpose**: Email verification and password reset tokens

**Design Decisions**:
- Standard NextAuth schema (don't modify)
- Session tokens vs JWT (currently using JWT)
- Verification tokens for email flows

---

## 🔗 Relationship Summary

| Parent | Child | Type | Delete Behavior |
|--------|-------|------|-----------------|
| User | Profile | 1:1 | Default (manual handling) |
| User | Cart | 1:1 | Cascade |
| User | Order | 1:Many | SetNull (keep orders) |
| User | Review | 1:Many | SetNull (keep reviews) |
| User | AdminLog | 1:Many | Cascade |
| User | Account | 1:Many | Default (NextAuth) |
| User | Session | 1:Many | Default (NextAuth) |
| Category | Product | 1:Many | Cascade |
| Product | Review | 1:Many | Cascade |

## 📈 Performance Optimizations

### Indexes Strategy

**Purpose of each index**:
1. **Foreign Keys**: Automatic index for joins
2. **Unique Fields**: Fast uniqueness checks
3. **Query Filters**: Speed up WHERE clauses
4. **Sorting**: Optimize ORDER BY

**Index Maintenance**:
- Prisma manages index creation
- Migrations track index changes
- Production indexes analyzed regularly

### Denormalization

**Where and why**:
1. **Product.rating & reviewsCount**
   - Avoid counting reviews on every query
   - Updated when review created/deleted

2. **Cart items with product data**
   - Faster cart rendering
   - No joins needed for display

3. **Order snapshot of products**
   - Historical accuracy
   - Immune to product changes

## 🔒 Data Integrity

### Constraints

1. **Unique Constraints**:
   - User.email (if provided)
   - User.mobile (if provided)
   - Category.slug
   - Product.slug
   - Product.sku (if provided)
   - Order.code

2. **Foreign Key Constraints**:
   - All relationships enforced
   - Cascade/SetNull as appropriate

3. **Check Constraints** (Application-level):
   - Review.rating between 1-5
   - Product.stock >= 0
   - Product.price > 0

### Validation

**Database Level**:
- NOT NULL constraints
- UNIQUE constraints
- Foreign key constraints

**Application Level** (Prisma):
- Type safety
- Required fields
- Custom validation

## 🔄 Migration Strategy

### Migration Files Location
```
prisma/migrations/
├── 20251216073127_init_auth_models/
├── 20251222073145_add_cart_model/
├── 20251222093446_add_products_categories_reviews/
└── 20251223101738_add_admin_features/
```

### Migration Commands
```bash
# Create new migration
npx prisma migrate dev --name description

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Migration Best Practices
1. Never edit migration files manually
2. Always test migrations on dev database first
3. Backup production before migrating
4. Plan for rollback strategy
5. Keep migrations atomic and focused

## 🌱 Database Seeding

**Seed File**: `prisma/seed.ts`

**What it seeds**:
1. Categories (Men, Women, Kids, Accessories)
2. Sample products with images
3. Admin user (optional)

**Run seeding**:
```bash
npx prisma db seed
```

---

**Last Updated**: December 2025  
**Maintained By**: Bhendi Bazaar Development Team


