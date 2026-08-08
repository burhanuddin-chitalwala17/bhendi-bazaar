// seed.prod.ts - Production essentials only
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {

  // 2. Shipping Provider (essential for checkout)
  await prisma.shippingProvider.create({
    data: {
      code: 'shiprocket',
      name: 'Shiprocket',
      isConnected: false, // Admin will connect it manually
    }
  });

  // 3. Admin User (essential for management)
  await prisma.user.create({
    data: {
      email: 'admin@bhendibazaar.com',
      name: 'Admin',
      passwordHash: await hash('STRONG_RANDOM_PASSWORD', 10),
      platformRole: 'ADMIN',
      isEmailVerified: true,
      profile: { create: {} }
    }
  });
}