# Tech Stack - Bhendi Bazaar

This document provides a comprehensive overview of all technologies, libraries, and tools used in the Bhendi Bazaar e-commerce platform.

## 📦 Core Technologies

### Framework & Runtime
| Technology      | Version | Purpose                                    |
|-----------------|---------|--------------------------------------------|
| **Next.js**     | 16.0.10 | Full-stack React framework with App Router |
| **React**       | 19.2.1  | UI library for building components         |
| **React DOM**   | 19.2.1  | React renderer for web                     |
| **TypeScript**  | ^5      | Type-safe JavaScript                       |
| **Node.js**     | ^20     | JavaScript runtime                         |

### Database & ORM
| Technology             | Version | Purpose                            |
|------------------------|---------|------------------------------------|
| **PostgreSQL**         | Latest  | Relational database                |
| **Prisma**             | ^7.1.0  | Modern database ORM                |
| **@prisma/client**     | ^7.1.0  | Prisma client for database queries |
| **@prisma/adapter-pg** | ^7.1.0  | PostgreSQL adapter for Prisma      |
| **pg**                 | ^8.16.3 | PostgreSQL client for Node.js      |

## 🔐 Authentication & Authorization

| Library | Version | Purpose |
|---------|---------|---------|
| **next-auth** | ^4.24.13 | Complete authentication solution for Next.js |
| **@auth/prisma-adapter** | ^2.11.1 | Prisma adapter for NextAuth.js |
| **bcryptjs** | ^3.0.3 | Password hashing library |

### Authentication Features
- **JWT Strategy**: Token-based authentication
- **OAuth Providers**: Google OAuth integration
- **Credentials Provider**: Email/password authentication
- **Session Management**: Secure session handling
- **Role-Based Access**: USER and ADMIN roles

## 💳 Payment Integration

| Library | Version | Purpose |
|---------|---------|---------|
| **razorpay** | ^2.9.5 | Payment gateway SDK for server-side operations |

### Payment Features
- Order creation with Razorpay API
- Payment verification with signature validation
- Webhook handling for payment events
- Client-side checkout modal integration

## 🎨 UI & Styling

### Core Styling
| Library | Version | Purpose |
|---------|---------|---------|
| **tailwindcss** | ^4 | Utility-first CSS framework |
| **@tailwindcss/postcss** | ^4 | PostCSS plugin for Tailwind |
| **postcss** | Latest | CSS transformation tool |
| **tw-animate-css** | ^1.4.0 | Animation utilities for Tailwind |

### UI Component Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| **@radix-ui/react-slot** | ^1.2.4 | Composition primitive for components |
| **@radix-ui/react-separator** | ^1.1.8 | Separator UI component |
| **lucide-react** | ^0.561.0 | Icon library (1000+ icons) |

### Utility Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| **class-variance-authority** | ^0.7.1 | Type-safe variant styling |
| **clsx** | ^2.1.1 | Utility for constructing className strings |
| **tailwind-merge** | ^3.4.0 | Merge Tailwind CSS classes without conflicts |

### Design System
- **Shadcn/ui**: Component library (New York style)
- **Base Color**: Neutral palette
- **Custom Theme**: Emerald primary, Gold accent colors
- **Design Inspiration**: Daytime courtyard aesthetic
- **Fonts**: 
  - Headings: Playfair Display (500, 600, 700)
  - Body: DM Sans

## 📊 State Management

| Library | Version | Purpose |
|---------|---------|---------|
| **zustand** | ^5.0.9 | Lightweight state management for cart |

### State Management Features
- **Cart Store**: Global shopping cart state
- **Persistence**: localStorage integration
- **Server Sync**: Automatic cart synchronization for authenticated users
- **Buy Now**: Temporary single-item purchase flow

## 📝 Form Management

| Library | Version | Purpose |
|---------|---------|---------|
| **react-hook-form** | ^7.68.0 | Performant form validation and handling |

### Form Features
- Type-safe form handling
- Built-in validation
- Admin product/category forms
- Checkout address forms
- Profile management forms

## 🔔 Notifications & Feedback

| Library | Version | Purpose |
|---------|---------|---------|
| **sonner** | ^2.0.7 | Toast notification library |

### Notification Features
- Success/error/info/warning toasts
- Rich colors and theming
- Top-right positioning
- Automatic dismissal
- Promise-based notifications

## 📦 File Storage & Media

| Service | Version | Purpose |
|---------|---------|---------|
| **@vercel/blob** | ^2.0.0 | Vercel Blob Storage for images |

### Storage Features
- Product image uploads
- Category hero images
- User profile pictures
- Optimized image delivery
- CDN integration

## 🛠️ Development Tools

### TypeScript Configuration
| Tool | Version | Purpose |
|------|---------|---------|
| **typescript** | ^5 | TypeScript compiler |
| **@types/node** | ^20 | Node.js type definitions |
| **@types/react** | ^19 | React type definitions |
| **@types/react-dom** | ^19 | React DOM type definitions |
| **@types/pg** | ^8.16.0 | PostgreSQL type definitions |
| **ts-node** | ^10.9.2 | TypeScript execution for Node.js |

### Linting & Code Quality
| Tool | Version | Purpose |
|------|---------|---------|
| **eslint** | ^9 | JavaScript/TypeScript linter |
| **eslint-config-next** | 16.0.10 | Next.js ESLint configuration |

### Build Tools
- **Next.js Compiler**: Built-in Rust-based compiler
- **SWC**: Fast TypeScript/JavaScript compiler
- **Turbopack**: Next-gen bundler (dev mode)

## 🗂️ Project Structure Technologies

### Path Aliases
```typescript
"@/*": ["./src/*"]
```

### Module System
- **ES Modules**: Modern JavaScript modules
- **Module Resolution**: Bundler strategy
- **Incremental Compilation**: Faster rebuilds

## 🔧 Configuration Files

### Key Configuration Files
| File | Purpose |
|------|---------|
| `next.config.ts` | Next.js configuration |
| `tsconfig.json` | TypeScript compiler options |
| `components.json` | Shadcn/ui configuration |
| `tailwind.config.js` | Tailwind CSS configuration (v4 in CSS) |
| `postcss.config.mjs` | PostCSS configuration |
| `eslint.config.mjs` | ESLint configuration |
| `prisma/schema.prisma` | Database schema definition |
| `.env` | Environment variables |

## 🚀 Scripts & Commands

### Available NPM Scripts
```json
{
  "dev": "next dev",           // Development server
  "build": "next build",       // Production build
  "start": "next start",       // Production server
  "lint": "eslint",            // Run linter
  "postinstall": "prisma generate"  // Generate Prisma client
}
```

## 🌐 External Services & APIs

### Required Services
1. **PostgreSQL Database**
   - Hosting: Vercel Postgres, Supabase, or self-hosted
   - Purpose: Primary data storage

2. **Razorpay Account**
   - Purpose: Payment processing
   - Required: API Key ID, API Key Secret, Webhook Secret

3. **Google OAuth**
   - Purpose: Social authentication
   - Required: Client ID, Client Secret

4. **Vercel Blob Storage**
   - Purpose: Image storage and delivery
   - Required: Vercel account

## 📱 Browser Compatibility

### Supported Browsers
- **Chrome**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Edge**: Latest 2 versions

### Features Used
- ES2017+ JavaScript
- CSS Grid & Flexbox
- CSS Custom Properties (variables)
- localStorage API
- Fetch API
- Async/Await

## 🔒 Security Libraries

### Security Features
| Feature              | Implementation                   |
|----------------------|----------------------------------|
| **Password Hashing** | bcryptjs (10 rounds)             |
| **JWT Tokens**       | NextAuth.js with secret signing  |
| **CSRF Protection**  | Built into NextAuth.js           |
| **SQL Injection**    | Prisma ORM parameterized queries |
| **XSS Protection**   | React automatic escaping         |
| **Rate Limiting**    | To be implemented                |

## 📊 Performance Optimizations

### Built-in Optimizations
- **Image Optimization**: Next.js Image component
- **Code Splitting**: Automatic route-based splitting
- **Tree Shaking**: Dead code elimination
- **Minification**: Production build optimization
- **Caching**: HTTP caching headers
- **CDN**: Vercel Edge Network

### Custom Optimizations
- **Lazy Loading**: Dynamic imports for heavy components
- **Debouncing**: Search input debouncing (1s)
- **Memoization**: React.memo for expensive renders
- **Pagination**: Server-side pagination for large datasets

## 🧪 Testing (To Be Implemented)

### Recommended Testing Stack
```json
{
  "jest": "Test runner",
  "@testing-library/react": "React component testing",
  "@testing-library/jest-dom": "DOM matchers",
  "playwright": "E2E testing"
}
```

## 📈 Monitoring & Analytics (To Be Implemented)

### Recommended Tools
- **Vercel Analytics**: Built-in analytics
- **Sentry**: Error tracking
- **Posthog**: Product analytics
- **LogRocket**: Session replay

## 🔄 Version Control

### Git Configuration
- **Platform**: GitHub/GitLab/Bitbucket
- **.gitignore**: Standard Next.js ignore patterns
- **Hooks**: Pre-commit linting (recommended)

## 📦 Package Manager

- **Primary**: npm (based on package-lock.json)
- **Compatible**: yarn, pnpm

## 🌍 Deployment

### Optimized For
- **Vercel**: First-class Next.js support
- **Alternative Platforms**: 
  - Docker containers
  - AWS (ECS, Amplify)
  - Google Cloud Run
  - Railway
  - Render

## 📚 Documentation Tools

### Markdown Support
- **Format**: GitHub Flavored Markdown
- **Code Blocks**: Syntax highlighting
- **Diagrams**: Mermaid (recommended)

## 🔗 Important Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [Razorpay Documentation](https://razorpay.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Shadcn/ui Documentation](https://ui.shadcn.com)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)

---

**Last Updated**: December 2025  
**Maintained By**: Bhendi Bazaar Development Team


