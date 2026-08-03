# Authentication System - Bhendi Bazaar

Complete documentation for the authentication and authorization system using NextAuth.js.

## 🔐 Overview

Bhendi Bazaar uses **NextAuth.js v4** with JWT strategy for authentication, supporting:
- Email/Password authentication (Credentials Provider)
- Google OAuth 2.0
- Role-based access control (USER/ADMIN)
- Session management with JWT tokens
- Route protection via middleware

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                        │
└──────────────────────────────────────────────────────────────┘

User Action (Login/OAuth)
         │
         ├─────> Email/Password ──────> Credentials Provider
         │                                      │
         │                                      ├─> Verify credentials
         │                                      ├─> Hash comparison (bcryptjs)
         │                                      └─> Return user object
         │
         └─────> Google OAuth ────────> Google Provider
                                               │
                                               ├─> OAuth2 flow
                                               ├─> Get user info
                                               └─> Create/update account
                  ↓
         NextAuth.js Callbacks
                  │
                  ├─> JWT Callback
                  │   ├─> Add user ID to token
                  │   ├─> Fetch role from database
                  │   └─> Add role to token
                  │
                  └─> Session Callback
                      ├─> Add user ID to session
                      └─> Add role to session
                  ↓
         Signed JWT Token
                  │
                  ├─> Stored in HTTP-only cookie
                  └─> Encrypted with NEXTAUTH_SECRET
                  ↓
         Client receives session
                  │
                  ├─> useSession() hook
                  ├─> getServerSession() (RSC)
                  └─> Middleware checks
```

## 📁 File Structure

```
src/
├── lib/
│   ├── auth.ts              # useAuth hook (client)
│   ├── auth-config.ts       # NextAuth configuration
│   └── admin-auth.ts        # Admin-specific auth utilities
│
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── [...nextauth]/
│   │       │   └── route.ts # NextAuth API handler
│   │       └── signup/
│   │           └── route.ts # User registration
│   │
│   └── (auth)/
│       ├── layout.tsx       # Auth pages layout
│       ├── signin/
│       │   └── page.tsx     # Sign in page
│       └── signup/
│           └── page.tsx     # Sign up page
│
└── middleware.ts            # Route protection
```

## 🔧 Configuration

### NextAuth Configuration (`lib/auth-config.ts`)

```typescript
export const authOptions: NextAuthOptions = {
  // Prisma adapter for database storage
  adapter: PrismaAdapter(prisma),
  
  // JWT strategy (stateless)
  session: {
    strategy: "jwt",
  },
  
  // Authentication providers
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Verify user credentials
        // Return user object or null
      },
    }),
  ],
  
  // Callbacks for token/session customization
  callbacks: {
    async jwt({ token, user }) {
      // Add user data to JWT token
    },
    async session({ session, token }) {
      // Add token data to session
    },
  },
};
```

### Environment Variables

```env
# NextAuth
NEXTAUTH_SECRET="your-secret-key-32-chars-min"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="xxx"
```

## 🔑 Authentication Methods

### 1. Email/Password Authentication

**Registration Flow**:
```
1. User fills signup form
2. POST /api/auth/signup
3. Validate email uniqueness
4. Hash password with bcryptjs (10 rounds)
5. Create User record in database
6. Create Profile record (optional)
7. Return success
8. Redirect to signin
```

**Sign In Flow**:
```
1. User fills signin form
2. POST /api/auth/signin (NextAuth endpoint)
3. Credentials provider validates:
   - Find user by email
   - Compare password hash
4. NextAuth creates JWT token
5. Set HTTP-only cookie
6. Redirect to homepage/callback URL
```

**Implementation**:

```typescript
// Registration (app/api/auth/signup/route.ts)
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const { email, password, name } = await req.json();
  
  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  
  if (existingUser) {
    return Response.json(
      { error: 'User already exists' },
      { status: 400 }
    );
  }
  
  // Hash password
  const passwordHash = await hash(password, 10);
  
  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'USER', // Default role
    },
  });
  
  return Response.json({ success: true, userId: user.id });
}
```

```typescript
// Credentials Provider (lib/auth-config.ts)
CredentialsProvider({
  async authorize(credentials) {
    if (!credentials?.email || !credentials.password) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    const isValid = await compare(
      credentials.password,
      user.passwordHash
    );

    if (!isValid) {
      return null;
    }

    return {
      id: user.id,
      name: user.name ?? undefined,
      email: user.email ?? undefined,
    };
  },
}),
```

### 2. Google OAuth Authentication

**OAuth Flow**:
```
1. User clicks "Sign in with Google"
2. Redirect to Google consent screen
3. User authorizes app
4. Google redirects back with auth code
5. NextAuth exchanges code for access token
6. NextAuth fetches user profile
7. NextAuth creates/updates Account record
8. NextAuth creates/updates User record
9. JWT token created
10. User signed in
```

**Configuration**:
```typescript
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID ?? "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
})
```

**Database Records Created**:
- `User` record (if new user)
- `Account` record (OAuth provider info)
- `Session` record (if using database sessions)

## 🛡️ Authorization & Roles

### Role-Based Access Control

**Roles**:
- `USER` - Regular customer (default)
- `ADMIN` - Admin panel access

**Role Assignment**:
```typescript
// Stored in User table
model User {
  role String @default("USER")
}

// Available in JWT token
const token = {
  id: "user-id",
  role: "ADMIN", // or "USER"
}

// Available in session
const session = {
  user: {
    id: "user-id",
    role: "ADMIN",
  }
}
```

### JWT Customization

**JWT Callback** (adds role to token):
```typescript
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      
      // Fetch role from database
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true },
      });
      
      token.role = dbUser?.role || "USER";
    }
    return token;
  },
}
```

**Session Callback** (adds role to session):
```typescript
callbacks: {
  async session({ session, token }) {
    if (session.user && token.sub) {
      (session.user as any).id = token.sub;
      (session.user as any).role = token.role || "USER";
    }
    return session;
  },
}
```

## 🚧 Route Protection

### Middleware Protection

**File**: `middleware.ts`

```typescript
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect admin routes
  if (pathname.startsWith("/admin")) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // Check if user is authenticated
    if (!token) {
      const signInUrl = new URL("/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Check if user has admin role
    const userRole = (token as any).role || "USER";
    if (userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}
```

**Protected Routes**:
- `/admin/*` - Requires ADMIN role
- All other routes - Public or user-specific checks in component

### API Route Protection

```typescript
// Example: Protected API route
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  // Check admin role
  if ((session.user as any).role !== "ADMIN") {
    return Response.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }
  
  // Protected logic here
}
```

### Component-Level Protection

**Client Component**:
```typescript
"use client";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export function ProfilePage() {
  const { data: session, status } = useSession();
  
  if (status === "loading") {
    return <div>Loading...</div>;
  }
  
  if (status === "unauthenticated") {
    redirect("/signin");
  }
  
  return <div>Profile: {session?.user?.name}</div>;
}
```

**Server Component**:
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/signin");
  }
  
  return <div>Profile: {session.user?.name}</div>;
}
```

## 🎣 Auth Hooks

### Custom useAuth Hook

**File**: `lib/auth.ts`

```typescript
import { useSession } from "next-auth/react";

export type AuthStatus = "guest" | "authenticated" | "loading";

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
}

export function useAuth(): { 
  status: AuthStatus; 
  user: AuthUser | null 
} {
  const { data, status } = useSession();

  if (status === "loading") {
    return { status: "loading", user: null };
  }

  if (status !== "authenticated" || !data?.user) {
    return { status: "guest", user: null };
  }

  const user = data.user as AuthUser & { id?: string };

  if (!user.id) {
    return { status: "guest", user: null };
  }

  return {
    status: "authenticated",
    user: {
      id: user.id,
      name: user.name ?? "",
      email: user.email,
    },
  };
}
```

**Usage**:
```typescript
const { status, user } = useAuth();

if (status === "loading") {
  return <Spinner />;
}

if (status === "guest") {
  return <LoginButton />;
}

return <div>Welcome, {user.name}!</div>;
```

## 🔄 Session Management

### Session Provider

**File**: `app/providers.tsx`

```typescript
"use client";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
```

### Getting Session Data

**Client-side**:
```typescript
import { useSession } from "next-auth/react";

const { data: session, status } = useSession();
```

**Server-side** (React Server Component):
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

const session = await getServerSession(authOptions);
```

**API Route**:
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  // Use session data
}
```

## 🔐 Security Features

### Password Security
- **Hashing Algorithm**: bcryptjs
- **Salt Rounds**: 10 (secure and performant)
- **Min Length**: 8 characters (enforced in UI)

### JWT Security
- **Encryption**: HS256 (HMAC with SHA-256)
- **Secret**: 32+ character random string
- **Cookie**: HTTP-only, Secure (in production)
- **Expiration**: 30 days (NextAuth default)

### CSRF Protection
- Built into NextAuth.js
- CSRF tokens for all state-changing operations

### Session Security
- JWT tokens encrypted and signed
- Tokens stored in HTTP-only cookies
- No token storage in localStorage
- Automatic token refresh

## 🚨 Error Handling

### Auth Errors

```typescript
// Sign in with error handling
import { signIn } from "next-auth/react";

const handleSignIn = async (email: string, password: string) => {
  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      // Handle error
      toast.error("Invalid credentials");
      return;
    }

    if (result?.ok) {
      // Success
      router.push("/");
    }
  } catch (error) {
    toast.error("Something went wrong");
  }
};
```

### Common Error Cases

| Error | Cause | Solution |
|-------|-------|----------|
| `SessionRequired` | No session found | Redirect to login |
| `AccessDenied` | Wrong role | Show "Access Denied" page |
| `Configuration` | Missing env vars | Check `.env` file |
| `InvalidCredentials` | Wrong email/password | Show error message |
| `OAuthSignin` | OAuth error | Check provider config |

## 📊 User Flow Examples

### New User Registration
```
1. Visit /signup
2. Fill form (email, password, name)
3. Submit → POST /api/auth/signup
4. User created in database
5. Redirect to /signin
6. Sign in with credentials
7. JWT token created
8. Redirect to homepage
```

### Returning User Login
```
1. Visit /signin
2. Enter credentials
3. Submit → POST /api/auth/signin
4. Credentials verified
5. JWT token created
6. Session established
7. Redirect to homepage or callback URL
```

### Google OAuth Login
```
1. Visit /signin
2. Click "Sign in with Google"
3. Redirect to Google consent
4. User authorizes
5. Callback to /api/auth/callback/google
6. Account created/linked
7. JWT token created
8. Redirect to homepage
```

### Admin Access
```
1. Sign in as admin user
2. Role "ADMIN" in JWT token
3. Visit /admin
4. Middleware checks token
5. Role verified as ADMIN
6. Access granted
```

## 🧪 Testing Authentication

### Test Accounts

Create test users:
```typescript
// scripts/create-test-users.ts
const testAdmin = await prisma.user.create({
  data: {
    email: "admin@test.com",
    name: "Test Admin",
    passwordHash: await hash("admin123", 10),
    role: "ADMIN",
  },
});

const testUser = await prisma.user.create({
  data: {
    email: "user@test.com",
    name: "Test User",
    passwordHash: await hash("user123", 10),
    role: "USER",
  },
});
```

### Manual Testing Checklist
- [ ] Register new user
- [ ] Sign in with email/password
- [ ] Sign in with Google OAuth
- [ ] Access protected user route
- [ ] Try accessing admin panel as user (should fail)
- [ ] Sign in as admin
- [ ] Access admin panel
- [ ] Sign out
- [ ] Session persists on page refresh

---

**Last Updated**: December 2025  
**Maintained By**: Bhendi Bazaar Development Team


