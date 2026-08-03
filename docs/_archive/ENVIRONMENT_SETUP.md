# Environment Setup - Bhendi Bazaar

This guide covers all environment variables, configuration, and setup instructions for running Bhendi Bazaar locally and in production.

## 📋 Prerequisites

Before setting up the project, ensure you have:

- **Node.js**: v20 or higher
- **npm**: v9 or higher (comes with Node.js)
- **PostgreSQL**: v14 or higher
- **Git**: Latest version

## 🚀 Quick Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd bhendi-bazaar
```

### 2. Install Dependencies

```bash
npm install
```

This will:
- Install all required packages
- Run `postinstall` script to generate Prisma client

### 3. Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

## 🔐 Environment Variables

### Required Variables

#### Database Configuration

```env
# PostgreSQL Database URL
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# Example for local development:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/bhendi_bazaar?schema=public"

# Example for Vercel Postgres:
# DATABASE_URL="postgres://default:xxx@xxx-pooler.aws.neon.tech:5432/verceldb?sslmode=require"
```

**Format Breakdown**:
- `USER`: Database username
- `PASSWORD`: Database password
- `HOST`: Database host (localhost for local)
- `PORT`: Database port (default: 5432)
- `DATABASE`: Database name

#### NextAuth Configuration

```env
# NextAuth Secret (Generate with: openssl rand -base64 32)
NEXTAUTH_SECRET="your-secret-key-here-min-32-chars"

# Application URL
NEXTAUTH_URL="http://localhost:3000"

# In production:
# NEXTAUTH_URL="https://your-domain.com"
```

**How to generate NEXTAUTH_SECRET**:
```bash
# On Unix/Mac/Linux:
openssl rand -base64 32

# On Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

#### Google OAuth (Optional but Recommended)

```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

**How to get Google OAuth credentials**:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-domain.com/api/auth/callback/google`

#### Razorpay Payment Gateway

```env
# Razorpay API Keys
RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxxxxx"
RAZORPAY_KEY_SECRET="your_secret_key_here"
RAZORPAY_WEBHOOK_SECRET="your_webhook_secret_here"
```

**How to get Razorpay credentials**:
1. Sign up at [Razorpay](https://razorpay.com)
2. Go to Dashboard → Settings → API Keys
3. Generate Test/Live mode keys
4. For webhook secret:
   - Go to Settings → Webhooks
   - Create webhook with URL: `https://your-domain.com/api/webhooks/razorpay`
   - Copy the webhook secret

**Important**: Use test keys for development, live keys for production

#### Vercel Blob Storage

```env
# Vercel Blob Storage Token
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxxxxxxxxxx"
```

**How to get Blob token**:
1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Go to Storage → Create → Blob Store
4. Copy the token from environment variables

**Alternative**: Can be auto-configured when deployed to Vercel

### Optional Variables

```env
# Node Environment
NODE_ENV="development"  # or "production"

# API Rate Limiting (Future implementation)
RATE_LIMIT_MAX="100"
RATE_LIMIT_WINDOW="900000"  # 15 minutes in ms

# Email Service (Future implementation)
EMAIL_SERVER="smtp://user:pass@smtp.example.com:587"
EMAIL_FROM="noreply@bhendibazaar.com"

# Analytics (Future implementation)
NEXT_PUBLIC_GA_ID="G-XXXXXXXXXX"
```

## 🗄️ Database Setup

### Local PostgreSQL Setup

#### Option 1: Using Docker (Recommended)

```bash
# Pull PostgreSQL image
docker pull postgres:16

# Run PostgreSQL container
docker run --name bhendi-bazaar-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=bhendi_bazaar \
  -p 5432:5432 \
  -d postgres:16

# Verify it's running
docker ps
```

#### Option 2: Native Installation

**macOS** (using Homebrew):
```bash
brew install postgresql@16
brew services start postgresql@16
createdb bhendi_bazaar
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb bhendi_bazaar
```

**Windows**:
Download and install from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

### Cloud Database Options

#### Vercel Postgres (Recommended for Vercel deployments)

```bash
# Install Vercel CLI
npm i -g vercel

# Create Postgres database
vercel postgres create
```

#### Supabase (Free tier available)

1. Sign up at [Supabase](https://supabase.com)
2. Create new project
3. Get connection string from Settings → Database
4. Use in `DATABASE_URL`

#### Railway (Free tier available)

1. Sign up at [Railway](https://railway.app)
2. Create new project → Add PostgreSQL
3. Copy connection string to `DATABASE_URL`

### Initialize Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database with sample data
npx prisma db seed
```

**What the seed does**:
- Creates sample categories (Men, Women, Kids, Accessories)
- Creates sample products with images
- Creates admin user (if needed)

### Prisma Studio (Database GUI)

```bash
# Open Prisma Studio
npx prisma studio
```

This opens a web interface at `http://localhost:5555` to view and edit database records.

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

Application will be available at:
- **Frontend**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Type Checking

```bash
# Check TypeScript types
npx tsc --noEmit
```

### Linting

```bash
# Run ESLint
npm run lint
```

## 👤 Creating Admin User

### Method 1: Through Database

```bash
# Open Prisma Studio
npx prisma studio

# Navigate to User table
# Create new user with:
# - email: admin@bhendibazaar.com
# - role: ADMIN
# - passwordHash: (use bcrypt to hash your password)
```

### Method 2: Using Prisma Client (Recommended)

Create a script `scripts/create-admin.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  const email = 'admin@bhendibazaar.com';
  const password = 'admin123'; // Change this!
  
  const passwordHash = await hash(password, 10);
  
  const admin = await prisma.user.create({
    data: {
      email,
      name: 'Admin',
      passwordHash,
      role: 'ADMIN',
    },
  });
  
  console.log('Admin created:', admin.email);
}

createAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run it:
```bash
npx ts-node scripts/create-admin.ts
```

## 🔍 Verification Checklist

After setup, verify:

- [ ] Database connection works
  ```bash
  npx prisma db push
  ```

- [ ] Environment variables loaded
  ```bash
  node -e "console.log(process.env.DATABASE_URL ? '✓ DB' : '✗ DB')"
  ```

- [ ] Prisma client generated
  ```bash
  ls -la node_modules/@prisma/client
  ```

- [ ] Application starts without errors
  ```bash
  npm run dev
  ```

- [ ] Can access homepage (http://localhost:3000)

- [ ] Can access admin panel (http://localhost:3000/admin)

- [ ] Google OAuth works (if configured)

- [ ] Razorpay test mode works (if configured)

## 🛠️ Troubleshooting

### Common Issues

#### 1. Database Connection Failed

**Error**: `Can't reach database server`

**Solutions**:
- Verify PostgreSQL is running: `pg_isready`
- Check DATABASE_URL format
- Verify host/port/credentials
- Check firewall rules
- For Docker: ensure container is running

#### 2. Prisma Client Not Generated

**Error**: `@prisma/client did not initialize yet`

**Solution**:
```bash
npx prisma generate
```

#### 3. Port Already in Use

**Error**: `Port 3000 is already in use`

**Solutions**:
```bash
# Find and kill process using port 3000
# macOS/Linux:
lsof -ti:3000 | xargs kill -9

# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use different port:
PORT=3001 npm run dev
```

#### 4. NextAuth Session Issues

**Error**: `[next-auth][error][JWT_SESSION_ERROR]`

**Solutions**:
- Ensure NEXTAUTH_SECRET is set (min 32 chars)
- Clear browser cookies
- Verify NEXTAUTH_URL matches current URL

#### 5. Razorpay Integration Issues

**Error**: Payment modal not opening

**Solutions**:
- Verify Razorpay script loads (check browser console)
- Ensure RAZORPAY_KEY_ID is set correctly
- Check browser console for errors
- Verify test mode is enabled

#### 6. Image Upload Issues

**Error**: Image upload fails

**Solutions**:
- Verify BLOB_READ_WRITE_TOKEN is set
- Check network connectivity
- Ensure image size is under 4.5MB
- Verify Vercel Blob storage is enabled

### Database Reset

If you need to reset the database:

```bash
# Warning: This will delete all data!

# Drop database and recreate
npx prisma migrate reset

# This will:
# 1. Drop the database
# 2. Create a new database
# 3. Run all migrations
# 4. Run seed script
```

### Clearing Caches

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Prisma generated files
rm -rf node_modules/.prisma
npx prisma generate
```

## 🌐 Development vs Production

### Development Environment

```env
NODE_ENV="development"
NEXTAUTH_URL="http://localhost:3000"
RAZORPAY_KEY_ID="rzp_test_xxxxx"  # Test mode
DATABASE_URL="postgresql://localhost:5432/bhendi_bazaar"
```

**Features**:
- Hot reload enabled
- Detailed error messages
- Prisma Studio access
- Test payment mode
- Source maps enabled

### Production Environment

```env
NODE_ENV="production"
NEXTAUTH_URL="https://yourdomain.com"
RAZORPAY_KEY_ID="rzp_live_xxxxx"  # Live mode
DATABASE_URL="postgresql://production-host/bhendi_bazaar?sslmode=require"
```

**Features**:
- Optimized builds
- Minified code
- Live payment mode
- SSL required for database
- Error logging only

## 📝 Environment File Template

Create `.env.example` for your repository:

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Razorpay
RAZORPAY_KEY_ID="rzp_test_xxxxx"
RAZORPAY_KEY_SECRET="your_secret_key"
RAZORPAY_WEBHOOK_SECRET="your_webhook_secret"

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxx"
```

## 🔒 Security Best Practices

1. **Never commit `.env` file** (already in `.gitignore`)
2. **Use different secrets** for dev/staging/production
3. **Rotate secrets regularly** (every 90 days)
4. **Use test mode** for payment gateways in development
5. **Enable SSL** for production database connections
6. **Store production secrets** in deployment platform (Vercel Environment Variables)
7. **Limit database user permissions** to what's needed
8. **Use strong passwords** (min 16 characters, random)

## 📚 Additional Resources

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Prisma Database Connection](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options)
- [Razorpay Integration Guide](https://razorpay.com/docs/payments/payment-gateway/web-integration/)

---

**Last Updated**: December 2025  
**Maintained By**: Bhendi Bazaar Development Team


