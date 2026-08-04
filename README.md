# 🛍️ Bhendi Bazaar

> A modern, full-stack e-commerce platform inspired by the vibrant lanes of Mumbai's iconic bazaars.

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.1-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Latest-336791?logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Key Features Deep Dive](#-key-features-deep-dive)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**Bhendi Bazaar** is a production-ready e-commerce platform built with modern web technologies. It features a beautiful, responsive UI inspired by traditional Indian bazaars, complete with full shopping cart functionality, secure payments via Razorpay, multi-origin shipping support, and a comprehensive admin panel.

### Why Bhendi Bazaar?

- **Production Ready**: Built with best practices, security, and scalability in mind
- **Modern Stack**: Next.js 16 App Router, React 19, TypeScript, Prisma ORM
- **Full-Featured**: Cart, checkout, payments, orders, shipping, admin panel
- **Type Safe**: End-to-end type safety with TypeScript and Prisma
- **Beautiful UI**: Modern design with Tailwind CSS and Shadcn/ui components
- **Developer Friendly**: Clean architecture, comprehensive docs, easy to extend

---

## ✨ Features

### 🛒 Shopping Experience
- **Product Catalog**: Browse products by categories with beautiful product cards
- **Search & Filter**: Real-time search with debouncing and advanced filtering
- **Shopping Cart**: Add items, update quantities, remove items with real-time calculations
- **Guest Checkout**: Purchase without creating an account
- **User Accounts**: Save addresses, view order history, manage profile
- **Wishlist**: Save products for later (coming soon)

### 💳 Payment & Orders
- **Razorpay Integration**: Secure payment processing with UPI, cards, wallets, and net banking
- **Order Management**: Track orders with detailed status updates
- **Multi-Origin Shipping**: Support for products from different warehouse locations
- **Shiprocket Integration**: Semi-manual shipping fulfillment with tracking updates
- **Order History**: View past orders with full details
- **Invoice Generation**: Download order invoices (coming soon)

### 🔐 Authentication & Security
- **Multiple Auth Methods**: Email/password and Google OAuth
- **JWT Sessions**: Secure, stateless authentication
- **Password Reset**: Email-based password recovery
- **Email Verification**: Verify email addresses for account security
- **Role-Based Access**: USER and ADMIN roles with protected routes
- **Rate Limiting**: API rate limiting with Upstash Redis

### 👨‍💼 Admin Panel
- **Dashboard**: Revenue stats, order metrics, and activity logs
- **Product Management**: CRUD operations with image uploads
- **Category Management**: Organize products into categories
- **Order Management**: View, update, and fulfill orders
- **User Management**: Manage users, roles, and permissions
- **Review Moderation**: Approve/reject product reviews
- **Cart Management**: View and manage active shopping carts
- **Seller Management**: Manage multiple sellers and warehouses
- **Shipping Providers**: Connect and configure Shiprocket integration

### 🎨 Design & UX
- **Responsive Design**: Mobile-first, works on all screen sizes
- **Dark Mode Ready**: (Coming soon)
- **Loading States**: Skeleton loaders for better perceived performance
- **Error Handling**: Graceful error states with retry options
- **Toast Notifications**: User-friendly feedback for all actions
- **Optimized Images**: Next.js Image optimization for fast loading

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **UI Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Components**: [Shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Forms**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Notifications**: [Sonner](https://sonner.emilkowal.ski/)

### Backend
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma 7](https://www.prisma.io/)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/)
- **Password Hashing**: [bcryptjs](https://www.npmjs.com/package/bcryptjs)
- **File Storage**: [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
- **Rate Limiting**: [Upstash Redis](https://upstash.com/)

### Integrations
- **Payment Gateway**: [Razorpay](https://razorpay.com/)
- **Shipping**: [Shiprocket](https://www.shiprocket.in/)
- **Email**: [Resend](https://resend.com/)
- **OAuth**: Google OAuth 2.0

### DevOps & Tooling
- **Package Manager**: npm
- **Testing**: [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/)
- **Linting**: ESLint
- **Type Checking**: TypeScript
- **Deployment**: [Vercel](https://vercel.com/) (optimized)

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20 or higher ([Download](https://nodejs.org/))
- **PostgreSQL** 14 or higher ([Download](https://www.postgresql.org/download/))
- **Git** ([Download](https://git-scm.com/downloads))
- A **Razorpay** account ([Sign up](https://razorpay.com/))
- A **Vercel** account for deployment ([Sign up](https://vercel.com/))

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/bhendi-bazaar.git
cd bhendi-bazaar
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Razorpay
RAZORPAY_KEY_ID="rzp_test_xxxxx"
RAZORPAY_KEY_SECRET="your_secret_key"
RAZORPAY_WEBHOOK_SECRET="your_webhook_secret"

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxx"

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL="your-upstash-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"

# Resend (Email)
RESEND_API_KEY="re_xxxxx"

# Shiprocket (Optional)
SHIPROCKET_EMAIL="your-shiprocket-email"
SHIPROCKET_PASSWORD="your-shiprocket-password"
```

> 💡 See [OPERATIONS.md](./docs/OPERATIONS.md) for detailed instructions on obtaining these credentials.

4. **Set up the database**

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database with sample data
npx prisma db seed
```

5. **Generate NextAuth secret**

```bash
# Generate a secure secret
openssl rand -base64 32
```

Copy the output to `NEXTAUTH_SECRET` in your `.env` file.

6. **Create an admin user**

```bash
# Hash your password
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('YourPassword123', 10).then(hash => console.log(hash));"

# Open Prisma Studio
npx prisma studio

# Navigate to User table and create a new user with:
# - email: admin@bhendibazaar.com
# - role: ADMIN
# - passwordHash: [paste the generated hash]
```

7. **Run the development server**

```bash
npm run dev
```

8. **Open your browser**

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Admin Panel**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Prisma Studio**: Run `npx prisma studio` to view database at [http://localhost:5555](http://localhost:5555)

---

## 📁 Project Structure

```
bhendi-bazaar/
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/             # Database migrations
│   └── seed/                   # Seed data scripts
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (main)/            # User-facing pages
│   │   │   ├── page.tsx       # Homepage
│   │   │   ├── product/       # Product pages
│   │   │   ├── category/      # Category pages
│   │   │   ├── cart/          # Shopping cart
│   │   │   ├── checkout/      # Checkout flow
│   │   │   ├── orders/        # Order history
│   │   │   └── profile/       # User profile
│   │   │
│   │   ├── (admin)/           # Admin panel
│   │   │   └── admin/
│   │   │       ├── page.tsx   # Dashboard
│   │   │       ├── products/  # Product management
│   │   │       ├── orders/    # Order management
│   │   │       ├── users/     # User management
│   │   │       └── ...        # Other admin pages
│   │   │
│   │   ├── (auth)/            # Authentication pages
│   │   │   ├── signin/
│   │   │   ├── signup/
│   │   │   └── forgot-password/
│   │   │
│   │   └── api/               # API Routes
│   │       ├── auth/          # NextAuth endpoints
│   │       ├── products/      # Product API
│   │       ├── orders/        # Order API
│   │       ├── cart/          # Cart API
│   │       ├── admin/         # Admin API
│   │       └── webhooks/      # Webhook handlers
│   │
│   ├── components/            # React components
│   │   ├── ui/               # Shadcn UI components
│   │   ├── admin/            # Admin components
│   │   ├── cart/             # Cart components
│   │   ├── product/          # Product components
│   │   └── shared/           # Shared components
│   │
│   ├── containers/           # Container components
│   │   └── checkoutContainer/
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── core/            # Core hooks (useAsyncData)
│   │   ├── product/         # Product hooks
│   │   ├── shipping/        # Shipping hooks
│   │   └── useAddressManager.ts
│   │
│   ├── services/            # Client-side API services
│   │   ├── productService.ts
│   │   ├── orderService.ts
│   │   ├── cartService.ts
│   │   └── ...
│   │
│   ├── store/               # Zustand state stores
│   │   └── cartStore.ts
│   │
│   ├── domain/              # Client-side types
│   │   ├── product.ts
│   │   ├── order.ts
│   │   ├── cart.ts
│   │   └── ...
│   │
│   ├── data-access-layer/   # Server-side data access (DAL)
│   │   ├── products.dal.ts
│   │   └── orders.dal.ts
│   │
│   └── lib/                 # Utility libraries
│       ├── prisma.ts        # Prisma client
│       ├── auth-config.ts   # NextAuth config
│       ├── rate-limit.ts    # Rate limiting
│       └── utils.ts         # Helper functions
│
├── server/                  # Server-side business logic
│   ├── domain/             # Server-side types
│   ├── repositories/       # Data access layer
│   │   ├── products.repository.ts
│   │   ├── orderRepository.ts
│   │   └── ...
│   ├── services/           # Business logic layer
│   │   ├── productService.ts
│   │   ├── orderService.ts
│   │   ├── paymentService.ts
│   │   └── ...
│   └── shipping/           # Shipping integration
│       ├── providers/      # Shiprocket, etc.
│       └── orchestrator.ts
│
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md
│   ├── TECH_STACK.md
│   ├── ENVIRONMENT_SETUP.md
│   └── features/          # Feature-specific docs
│
├── public/                # Static assets
│   ├── images/
│   └── fonts/
│
├── tests/                 # Test files
│
├── .env.example          # Environment variables template
├── next.config.ts        # Next.js configuration
├── tailwind.config.js    # Tailwind configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies
```

---

## 🎯 Key Features Deep Dive

### 🛒 Smart Shopping Cart

The shopping cart is built with a robust state management system that works seamlessly for both guest and authenticated users.

**Features:**
- ✅ Persistent cart (localStorage for guests, database for users)
- ✅ Real-time price calculations
- ✅ Multi-origin shipping support
- ✅ Automatic stock validation
- ✅ Cart synchronization across devices for logged-in users
- ✅ "Buy Now" for instant checkout

**How it works:**
1. Guest users: Cart stored in localStorage only
2. Authenticated users: Cart synced to database
3. On login: Local cart merges with server cart
4. On cart change: Debounced sync to server (1s delay)

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) and [CONTRACTS.md](./docs/CONTRACTS.md) for more details.

### 💳 Secure Payment Processing

Integrated with Razorpay for secure payment processing with support for multiple payment methods.

**Features:**
- ✅ Multiple payment methods (UPI, Cards, Wallets, Net Banking)
- ✅ Test mode for development
- ✅ Webhook verification for payment confirmation
- ✅ Automatic order status updates
- ✅ Payment failure handling with retry
- ✅ Signature verification for security

**Payment Flow:**
1. User completes checkout
2. Order created with `pending_payment` status
3. Razorpay checkout modal opens
4. User completes payment
5. Payment verified via signature
6. Order status updated to `paid`
7. Webhook confirmation (backup)

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) and [INTEGRATIONS.md](./docs/INTEGRATIONS.md) for more details.

### 📦 Multi-Origin Shipping

Support for products from different warehouse locations with intelligent shipping cost calculation.

**Features:**
- ✅ Multiple sellers/warehouses
- ✅ Automatic shipment grouping by origin
- ✅ Shiprocket API integration
- ✅ Real-time shipping rate calculation
- ✅ Semi-manual fulfillment workflow
- ✅ Tracking number management
- ✅ Shipment status updates

**Shipping Flow:**
1. Products have `shippingFromPincode` field
2. Cart items grouped by shipping origin
3. Shipping rates fetched from Shiprocket
4. Separate shipments created for each origin
5. Admin manually fulfills orders via Shiprocket website
6. Tracking numbers added via admin panel
7. Webhook updates shipment status

See [Shipping Documentation](./docs/_archive/server-shipping-README.md) for more details.

### 👨‍💼 Comprehensive Admin Panel

Full-featured admin dashboard for managing all aspects of the e-commerce platform.

**Features:**
- ✅ Real-time dashboard with key metrics
- ✅ Product CRUD with image uploads
- ✅ Category management
- ✅ Order management and fulfillment
- ✅ User management with role assignment
- ✅ Review moderation
- ✅ Cart inspection
- ✅ Seller management
- ✅ Shipping provider configuration
- ✅ Activity logs for audit trail

**Admin Routes:**
- `/admin` - Dashboard
- `/admin/products` - Product management
- `/admin/orders` - Order management
- `/admin/users` - User management
- `/admin/categories` - Category management
- `/admin/reviews` - Review moderation
- `/admin/sellers` - Seller management
- `/admin/shipping/providers` - Shipping configuration

---

## 📚 API Documentation

### Public API Routes

#### Products
```
GET    /api/products          # List all products
GET    /api/products/[slug]   # Get product by slug
GET    /api/products/offers   # Get products on sale
GET    /api/products/hero     # Get featured products
POST   /api/products/search   # Search products
```

#### Categories
```
GET    /api/categories        # List all categories
GET    /api/categories/[slug] # Get category by slug
```

#### Cart
```
GET    /api/cart              # Get user cart
POST   /api/cart              # Create/update cart
PUT    /api/cart              # Update cart
DELETE /api/cart              # Clear cart
```

#### Orders
```
GET    /api/orders            # List user orders
GET    /api/orders/[id]       # Get order by ID
POST   /api/orders            # Create order
PATCH  /api/orders/[id]       # Update order
POST   /api/orders/create-with-shipments  # Create order with multiple shipments
POST   /api/orders/lookup     # Lookup order by code (guest)
```

#### Authentication
```
POST   /api/auth/signin       # Sign in
POST   /api/auth/signup       # Sign up
POST   /api/auth/signout      # Sign out
GET    /api/auth/session      # Get session
POST   /api/auth/callback/*   # OAuth callbacks
```

### Admin API Routes

All admin routes require `ADMIN` role and are prefixed with `/api/admin/`.

```
GET    /api/admin/dashboard              # Dashboard stats
GET    /api/admin/dashboard/activities   # Recent activities
GET    /api/admin/dashboard/revenue      # Revenue chart

GET    /api/admin/products               # List products
POST   /api/admin/products               # Create product
GET    /api/admin/products/[id]          # Get product
PUT    /api/admin/products/[id]          # Update product
DELETE /api/admin/products/[id]          # Delete product

GET    /api/admin/orders                 # List orders
GET    /api/admin/orders/[id]            # Get order
PATCH  /api/admin/orders/[id]            # Update order
POST   /api/admin/shipments/[id]/tracking # Update tracking

GET    /api/admin/users                  # List users
GET    /api/admin/users/[id]             # Get user
PATCH  /api/admin/users/[id]             # Update user
DELETE /api/admin/users/[id]             # Delete user

GET    /api/admin/reviews                # List reviews
PATCH  /api/admin/reviews/[id]           # Update review status
```

### Webhooks

```
POST   /api/webhooks/razorpay             # Razorpay payment webhooks
POST   /api/webhooks/shipping/shiprocket  # Shiprocket shipping updates
```

---

## 🚀 Deployment

### Deploying to Vercel (Recommended)

1. **Push your code to GitHub**

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Import project to Vercel**

- Go to [Vercel Dashboard](https://vercel.com/dashboard)
- Click "Add New" → "Project"
- Import your GitHub repository
- Vercel auto-detects Next.js configuration

3. **Configure environment variables**

Add all environment variables from your `.env` file in Vercel:
- Project Settings → Environment Variables
- Add production values for all variables
- Use `rzp_live_*` for Razorpay in production

4. **Set up database**

Option A: Vercel Postgres
```bash
vercel postgres create
```

Option B: External database (Supabase, Railway, etc.)
- Create PostgreSQL database
- Add `DATABASE_URL` to Vercel environment variables

5. **Run migrations**

After deployment, run migrations:
```bash
# Install Vercel CLI
npm i -g vercel

# Pull environment
vercel env pull

# Run migrations
npx prisma migrate deploy
```

6. **Configure webhooks**

Update webhook URLs in:
- **Razorpay**: Dashboard → Webhooks → `https://yourdomain.com/api/webhooks/razorpay`
- **Shiprocket**: Settings → Webhooks → `https://yourdomain.com/api/webhooks/shipping/shiprocket`

7. **Set up domain** (Optional)

- Go to Project Settings → Domains
- Add your custom domain
- Update `NEXTAUTH_URL` to your production domain

### Alternative Deployment Options

<details>
<summary><b>Docker</b></summary>

```dockerfile
FROM node:20-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t bhendi-bazaar .
docker run -p 3000:3000 --env-file .env bhendi-bazaar
```
</details>

<details>
<summary><b>Other Platforms</b></summary>

The application can be deployed to any platform that supports Node.js:

- **Railway**: Connect GitHub, auto-deploy on push
- **Render**: Supports Node.js and PostgreSQL
- **AWS Amplify**: Full-stack hosting
- **Google Cloud Run**: Containerized deployment
- **DigitalOcean App Platform**: Node.js hosting

**Key Requirements:**
- Node.js 20+
- PostgreSQL database
- Environment variables configured
- `npm run build` for production build
- `npm start` to run server
</details>

### Post-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Admin user created
- [ ] Products seeded (optional)
- [ ] Payment webhooks configured
- [ ] Shipping webhooks configured
- [ ] Test payment flow (test mode)
- [ ] Test order creation
- [ ] Test admin panel access
- [ ] Configure domain (optional)
- [ ] Set up monitoring (Vercel Analytics, Sentry)
- [ ] Enable analytics (Google Analytics, Posthog)

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Manual Testing

#### Test Payment Flow
1. Use Razorpay test credentials
2. Test card: `4111 1111 1111 1111`
3. Any CVV and future expiry date
4. Complete payment flow
5. Verify order status updates

#### Test Shipping Rates
1. Add products to cart
2. Proceed to checkout
3. Enter delivery pincode
4. Verify shipping rates appear
5. Complete checkout

#### Test Admin Panel
1. Login as admin
2. Create/edit products
3. Manage orders
4. Update shipment tracking
5. Moderate reviews

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**

2. **Create a feature branch**
```bash
git checkout -b feature/amazing-feature
```

3. **Make your changes**
- Follow existing code style
- Add tests if applicable
- Update documentation

4. **Commit your changes**
```bash
git commit -m "Add amazing feature"
```

5. **Push to your fork**
```bash
git push origin feature/amazing-feature
```

6. **Open a Pull Request**
- Describe your changes
- Link related issues
- Wait for review

### Development Guidelines

- **Code Style**: Follow existing patterns and conventions
- **TypeScript**: Ensure full type safety, no `any` types
- **Components**: Keep components small and focused
- **Testing**: Add tests for new features
- **Documentation**: Update docs for significant changes
- **Commits**: Write clear, descriptive commit messages

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Design Inspiration**: Mumbai's Bhendi Bazaar and traditional Indian markets
- **UI Components**: [Shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide Icons](https://lucide.dev/)
- **Payment Gateway**: [Razorpay](https://razorpay.com/)
- **Shipping Integration**: [Shiprocket](https://www.shiprocket.in/)

---

## 📞 Support

- **Documentation**: [./docs](./docs)
- **Issues**: [GitHub Issues](https://github.com/yourusername/bhendi-bazaar/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/bhendi-bazaar/discussions)

---

## 🗺️ Roadmap

### Planned Features
- [ ] Dark mode support
- [ ] Wishlist functionality
- [ ] Product reviews and ratings
- [ ] Email notifications
- [ ] Invoice generation
- [ ] Advanced analytics
- [ ] Multi-currency support
- [ ] Inventory management
- [ ] Customer support chat
- [ ] Mobile app (React Native)

### Completed
- [x] Shopping cart with persistence
- [x] Razorpay payment integration
- [x] Multi-origin shipping
- [x] Admin panel
- [x] Order management
- [x] User authentication
- [x] Product catalog
- [x] Shiprocket integration

---

<div align="center">

**Built with ❤️ by the Bhendi Bazaar Team**

[⬆ Back to Top](#️-bhendi-bazaar)

</div>
