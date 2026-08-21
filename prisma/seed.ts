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
import type { SeedProduct } from "./seed/types";
import { assertSeedTargetIsAllowed } from "./seed-guard";

/** Per-unit markdown on a seeded line, or zero — the same guard the engine applies. */
function markdownOf(item: { price: number; salePrice?: number }): number {
  const { price, salePrice } = item;
  return salePrice && salePrice > 0 && salePrice < price ? price - salePrice : 0;
}

// Use the same adapter configuration as the main app
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

/**
 * The fixture keeps a readable `images` array; the gallery is rows. The item matching
 * `thumbnail` is the cover, so a seeded product satisfies R15 the same way the
 * migration's backfill makes an existing one satisfy it — and where no image matches
 * (several fixtures have a thumbnail that is not in their gallery) the first wins, which
 * is the same rule the backfill uses.
 */
function seedMediaRows(product: SeedProduct) {
  const images = product.images.length ? product.images : [product.thumbnail];
  const coverIndex = Math.max(0, images.indexOf(product.thumbnail));
  const rows: Array<{
    kind: "IMAGE" | "YOUTUBE";
    ref: string;
    position: number;
    isThumbnail: boolean;
  }> = images.map((ref, index) => ({
    kind: "IMAGE",
    ref,
    position: index,
    isThumbnail: index === coverIndex,
  }));

  if (product.video) {
    rows.push({ kind: "YOUTUBE", ref: product.video, position: rows.length, isThumbnail: false });
  }
  return rows;
}

async function main() {
  assertSeedTargetIsAllowed();

  console.log("🌱 Starting database seed...\n");

  // Clear existing data (in correct order to respect foreign keys)
  console.log("🗑️  Clearing existing data...");
  // Children before parents, always — money and attribution rows are Restrict
  // (ADR-0020), so a wrong order here is an FK error, not a silent cascade.
  // Ledger and settlement first: they hang off orders, items, and orgs.
  await prisma.orgLedgerEntryLine.deleteMany();
  await prisma.orgLedgerEntry.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.orderDiscount.deleteMany(); // before orders and promotions
  await prisma.promotionTarget.deleteMany(); // before promotions, products, categories
  await prisma.promotion.deleteMany();
  await prisma.orgCommissionRule.deleteMany();
  await prisma.shippingEvent.deleteMany(); // before shipments
  await prisma.shipmentItem.deleteMany(); // before shipments and order items
  await prisma.shipment.deleteMany(); // before orders and org addresses
  await prisma.shippingRateCache.deleteMany();
  await prisma.shippingProvider.deleteMany(); // re-created below from fixtures
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.review.deleteMany();
  await prisma.productStock.deleteMany(); // before products and org addresses
  await prisma.productMedia.deleteMany();
  await prisma.product.deleteMany();
  await prisma.orgMember.deleteMany(); // before orgs; explicit rather than via cascade
  await prisma.orgAddress.deleteMany(); // before orgs and addresses
  await prisma.userAddress.deleteMany(); // before users and addresses
  await prisma.address.deleteMany();
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
            profilePic: userData.profile.profilePic,
          },
        },
      },
    });

    // PR-41: the address book is rows, not a blob. isDefault from old seed
    // shapes is dropped by decision — nothing is preselected.
    for (const a of userData.profile.addresses ?? []) {
      const postal = await prisma.address.create({
        data: {
          addressLine1: a.addressLine1,
          addressLine2: a.addressLine2 ?? null,
          landmark: a.landmark ?? null,
          city: a.city,
          state: a.state,
          pincode: a.pincode,
          country: "India",
          createdBy: user.id,
        },
      });
      await prisma.userAddress.create({
        data: {
          userId: user.id,
          addressId: postal.id,
          label: a.label ?? null,
          fullName: a.fullName,
          phone: a.mobile,
        },
      });
    }
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
        accent: categoryData.accent,
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

    // One pickup location per org — where its seeded stock sits (stock-locations).
    await prisma.orgAddress.create({
      data: {
        id: `${org.id}-pickup`,
        org: { connect: { id: org.id } },
        name: "Primary pickup",
        contactName: orgData.contactPerson ?? "",
        contactPhone: orgData.phone ?? "",
        address: {
          create: {
            addressLine1: orgData.pickup.address,
            city: orgData.pickup.city,
            state: orgData.pickup.state,
            pincode: orgData.pickup.pincode,
          },
        },
      },
    });
  }
  console.log(`✅ ${seedOrgs.length} orgs seeded, each with an owner and a pickup location\n`);

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
        orgId: productData.orgId,
        currency: productData.currency,
        categoryId: productData.categoryId,
        tags: productData.tags,
        flags: productData.flags,
        rating: productData.rating,
        reviewsCount: productData.reviewsCount,
        thumbnail: productData.thumbnail,
        media: { create: seedMediaRows(productData) },
        sizes: productData.sizes,
        colors: productData.colors,
        // Quantity lives on the join row, at the org's seeded pickup location.
        stockLocations: {
          create: [{ orgAddressId: `${productData.orgId}-pickup`, quantity: productData.stock }],
        },
        sku: productData.sku,
        lowStockThreshold: productData.lowStockThreshold,
        weight: productData.weight || 0.5, // ⭐ Default to 0.5kg if not specified
      },
    });
    console.log(`  ✓ ${product.name} (Stock: ${productData.stock})`);
  }
  console.log(`✅ ${seedProducts.length} products seeded\n`);

  // A markdown is an org-funded offer at a fixed selling price, not a column
  // (promotions D9). Ids mirror the backfill migration, so a seeded store and a
  // migrated one are shaped the same.
  console.log("🏷️  Seeding markdowns as offers...");
  const markedDown = seedProducts.flatMap((product) =>
    markdownOf(product) > 0 && product.salePrice !== undefined
      ? [{ ...product, salePrice: product.salePrice }]
      : []
  );
  for (const productData of markedDown) {
    await prisma.promotion.create({
      data: {
        id: `mkdn_${productData.id}`,
        label: `Markdown — ${productData.name}`,
        scope: "ORG",
        orgId: productData.orgId,
        trigger: "AUTOMATIC",
        valueType: "FIXED_PRICE",
        fixedPricePaise: productData.salePrice,
        startsAt: new Date(),
        endsAt: new Date("2099-12-31T00:00:00Z"),
        targets: { create: [{ id: `mkdntgt_${productData.id}`, productId: productData.id }] },
      },
    });
  }
  console.log(`✅ ${markedDown.length} markdowns seeded as offers\n`);

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
        orgAddressId: `${shipmentData.orgId}-pickup`,
        // Lines are rows since order-and-cart-lines: one OrderItem per line, its
        // ShipmentItem 1:1. unitPrice applies the same rule checkout charges.
        items: {
          create: shipmentData.items.map((item) => ({
            quantity: item.quantity,
            orderItem: {
              create: {
                orderId: shipmentData.orderId,
                productId: item.productId,
                quantity: item.quantity,
                // unitPrice is the list price and the reduction is its own figure,
                // matching how checkout records a line now (ADR-0019). A markdown is
                // org-funded, so it lands wholly on the organisation's side.
                unitPrice: item.price,
                discountPaise: markdownOf(item) * item.quantity,
                orgFundedPaise: markdownOf(item) * item.quantity,
              },
            },
          })),
        },
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
        // Only the choice is stored; price and display fields derive from the product.
        items: {
          create: cartData.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
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
