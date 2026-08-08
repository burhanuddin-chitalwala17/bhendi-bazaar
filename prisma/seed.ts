/**
 * Prisma Database Seed Script
 *
 * This script populates the database with realistic seed data for:
 * - Users (with profiles and addresses)
 * - Categories
 * - Products
 * - Orders
 * - Reviews
 * - Abandoned Carts
 *
 * Run with: npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import {
  seedUsers,
  seedCategories,
  seedOrgs,
  seedProducts,
  seedOrders,
  seedShipments,
  seedReviews,
  seedCarts,
  seedShippingProviders,
} from "./seed/index";

// Use the same adapter configuration as the main app
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🌱 Starting database seed...\n");

  // Clear existing data (in correct order to respect foreign keys)
  console.log("🗑️  Clearing existing data...");
  await prisma.shippingProvider.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.review.deleteMany();
  await prisma.shipment.deleteMany(); // ⭐ NEW - Clear shipments before orders
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.orgMember.deleteMany(); // before orgs; explicit rather than via cascade
  await prisma.org.deleteMany();
  await prisma.category.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.adminLog.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  console.log("✅ Existing data cleared\n");

  // ====================
  // SEED USERS
  // ====================
  console.log("👥 Seeding users and profiles...");
  for (const userData of seedUsers) {
    // Hash the password
    const hashedPassword = await hash(userData.passwordPlain, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        passwordHash: hashedPassword,
        platformRole: userData.platformRole,
        mobile: userData.mobile,
        isEmailVerified: userData.isEmailVerified,
        profile: {
          create: {
            addresses: userData.profile.addresses as any,
            profilePic: userData.profile.profilePic,
          },
        },
      },
    });

    console.log(`  ✓ ${user.name} (${user.platformRole}) - ${user.email}`);
  }
  console.log(`✅ ${seedUsers.length} users seeded\n`);

  // ====================
  // SEED CATEGORIES
  // ====================
  console.log("📦 Seeding categories...");
  for (const categoryData of seedCategories) {
    const category = await prisma.category.create({
      data: {
        id: categoryData.id,
        slug: categoryData.slug,
        name: categoryData.name,
        description: categoryData.description,
        heroImage: categoryData.heroImage,
        accentColorClass: categoryData.accentColorClass,
        order: categoryData.order,
      },
    });
    console.log(`  ✓ ${category.name}`);
  }
  console.log(`✅ ${seedCategories.length} categories seeded\n`);

  // ====================
  // SEED ORGS (NEW - before products)
  // ====================
  const ownerUserId = seedUsers.find((u) => u.platformRole === "ADMIN")?.id;
  if (!ownerUserId) throw new Error("Seed data has no ADMIN user to own the seeded orgs");

  console.log("🏪 Seeding orgs...");
  for (const orgData of seedOrgs) {
    const org = await prisma.org.create({
      data: {
        id: orgData.id,
        code: orgData.code,
        name: orgData.name,
        email: orgData.email,
        phone: orgData.phone,
        contactPerson: orgData.contactPerson,
        defaultPincode: orgData.defaultPincode,
        defaultCity: orgData.defaultCity,
        defaultState: orgData.defaultState,
        defaultAddress: orgData.defaultAddress,
        businessName: orgData.businessName,
        gstNumber: orgData.gstNumber,
        panNumber: orgData.panNumber,
        isActive: orgData.isActive,
        isVerified: orgData.isVerified,
        description: orgData.description,
        logoUrl: orgData.logoUrl,
      },
    });
    console.log(`  ✓ ${org.name} (${org.code})`);

    // Every seeded org gets an owner, so the org portal is reachable locally without
    // going through onboarding. Orgs created before memberships existed have none:
    // `contactPerson` is a free-text name, so there is no owner to infer.
    await prisma.orgMember.create({
      data: { userId: ownerUserId, orgId: org.id, role: "OWNER" },
    });
  }
  console.log(`✅ ${seedOrgs.length} orgs seeded, each with an owner\n`);

  // ====================
  // SEED PRODUCTS
  // ====================
  console.log("🛍️  Seeding products...");
  for (const productData of seedProducts) {
    const product = await prisma.product.create({
      data: {
        id: productData.id,
        slug: productData.slug,
        name: productData.name,
        description: productData.description,
        price: productData.price,
        salePrice: productData.salePrice || null,
        orgId: productData.orgId,
        currency: productData.currency,
        categoryId: productData.categoryId,
        tags: productData.tags,
        flags: productData.flags,
        rating: productData.rating,
        reviewsCount: productData.reviewsCount,
        images: productData.images,
        thumbnail: productData.thumbnail,
        sizes: productData.sizes,
        colors: productData.colors,
        stock: productData.stock,
        sku: productData.sku,
        lowStockThreshold: productData.lowStockThreshold,
        weight: productData.weight || 0.5, // ⭐ Default to 0.5kg if not specified
      },
    });
    console.log(`  ✓ ${product.name} (Stock: ${product.stock})`);
  }
  console.log(`✅ ${seedProducts.length} products seeded\n`);

  // ====================
  // SEED ORDERS
  // ====================
  console.log("📦 Seeding orders...");
  for (const orderData of seedOrders) {
    const order = await prisma.order.create({
      data: {
        id: orderData.id,
        code: orderData.code,
        userId: orderData.userId,
        address: orderData.address as any,
        notes: orderData.notes,
        itemsTotal: orderData.itemsTotal,
        shippingTotal: orderData.shippingTotal,
        discount: orderData.discount,
        grandTotal: orderData.grandTotal,
        status: orderData.status,
        paymentMethod: orderData.paymentMethod,
        paymentStatus: orderData.paymentStatus,
        paymentId: orderData.paymentId,
        createdAt: orderData.createdAt,
      },
    });
    console.log(
      `  ✓ ${order.code} - ${order.status} (${
        orderData.userId ? "User" : "Guest"
      })`
    );
  }
  console.log(`✅ ${seedOrders.length} orders seeded\n`);

  // ====================
  // SEED SHIPMENTS
  // ====================
  console.log("📦 Seeding shipments...");
  for (const shipmentData of seedShipments) {
    const shipment = await prisma.shipment.create({
      data: {
        id: shipmentData.id,
        code: shipmentData.code,
        orderId: shipmentData.orderId,
        items: shipmentData.items as any,
        orgId: shipmentData.orgId,
        fromPincode: shipmentData.fromPincode,
        fromCity: shipmentData.fromCity,
        fromState: shipmentData.fromState,
        shippingCost: shipmentData.shippingCost,
        shippingProviderId: shipmentData.shippingProviderId,
        trackingNumber: shipmentData.trackingNumber,
        courierName: shipmentData.courierName,
        trackingUrl: shipmentData.trackingUrl,
        status: shipmentData.status,
        packageWeight: shipmentData.packageWeight,
        estimatedDelivery: shipmentData.estimatedDelivery,
        createdAt: shipmentData.createdAt,
      },
    });
    console.log(
      `  ✓ ${shipment.code} - ${shipment.status} (${shipment.fromCity})`
    );
  }
  console.log(`✅ ${seedShipments.length} shipments seeded\n`);

  // ====================
  // SEED REVIEWS
  // ====================
  console.log("⭐ Seeding reviews...");
  for (const reviewData of seedReviews) {
    const review = await prisma.review.create({
      data: {
        id: reviewData.id,
        productId: reviewData.productId,
        userId: reviewData.userId,
        rating: reviewData.rating,
        title: reviewData.title,
        comment: reviewData.comment,
        userName: reviewData.userName,
        isVerified: reviewData.isVerified,
        isApproved: reviewData.isApproved,
        createdAt: reviewData.createdAt,
      },
    });
    console.log(
      `  ✓ ${review.userName} - ${review.rating}⭐ on product ${reviewData.productId}`
    );
  }
  console.log(`✅ ${seedReviews.length} reviews seeded\n`);

  // ====================
  // UPDATE PRODUCT RATINGS
  // ====================
  console.log("📊 Calculating product ratings...");
  for (const product of seedProducts) {
    const reviews = seedReviews.filter((r) => r.productId === product.id);
    if (reviews.length > 0) {
      const avgRating =
        reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await prisma.product.update({
        where: { id: product.id },
        data: {
          rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
          reviewsCount: reviews.length,
        },
      });
      console.log(
        `  ✓ ${product.name} - ${avgRating.toFixed(1)}⭐ (${
          reviews.length
        } reviews)`
      );
    }
  }
  console.log("✅ Product ratings updated\n");

  // ====================
  // SEED ABANDONED CARTS
  // ====================
  console.log("🛒 Seeding abandoned carts...");
  for (const cartData of seedCarts) {
    const cart = await prisma.cart.create({
      data: {
        id: cartData.id,
        userId: cartData.userId,
        items: cartData.items as any,
        updatedAt: cartData.updatedAt,
      },
    });
    console.log(
      `  ✓ Cart for user ${cartData.userId} - ${
        cartData.items.length
      } items (${Math.floor(
        (Date.now() - cartData.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      )} days old)`
    );
  }
  console.log(`✅ ${seedCarts.length} abandoned carts seeded\n`);

  // ====================
  // SEED SHIPPING PROVIDERS
  // ====================
  console.log("🚚 Seeding shipping providers...");
  for (const shippingProviderData of seedShippingProviders) {
    const shippingProvider = await prisma.shippingProvider.create({
      data: shippingProviderData as any,
    });
    console.log(`  ✓ ${shippingProvider.name}`);
  }
  console.log(`✅ ${seedShippingProviders.length} shipping providers seeded\n`);

  // ====================
  // SUMMARY
  // ====================
  console.log("🎉 Database seed completed successfully!\n");
  console.log("📊 Summary:");
  console.log(
    `   • ${seedUsers.length} users (${
      seedUsers.filter((u) => u.platformRole === "ADMIN").length
    } admins, ${
      seedUsers.filter((u) => u.platformRole === "USER").length
    } regular users)`
  );
  console.log(`   • ${seedCategories.length} categories`);
  console.log(`   • ${seedOrgs.length} orgs`);
  console.log(`   • ${seedProducts.length} products`);
  console.log(
    `   • ${seedOrders.length} orders (${
      seedOrders.filter((o) => o.userId === null).length
    } guest orders)`
  );
  console.log(`   • ${seedShipments.length} shipments (${seedShipments.filter((s) => s.status === "pending").length
    } pending tracking)`);
  console.log(
    `   • ${seedReviews.length} reviews (${
      seedReviews.filter((r) => r.isVerified).length
    } verified)`
  );
  console.log(`   • ${seedCarts.length} abandoned carts`);
  console.log(`   • ${seedShippingProviders.length} shipping providers`);
  console.log("\n💡 Next steps:");
  console.log("   1. Upload product/category images to Vercel Blob");
  console.log("   2. Update image URLs in seed data files");
  console.log("   3. Re-run seed to update with real image URLs");
  console.log("\n📝 Default credentials:");
  console.log("   Admin: admin@bhendibazaar.com / Admin@123");
  console.log("   Manager: manager@bhendibazaar.com / Admin@123");
  console.log("   Users: [email from seed] / Test@123");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
