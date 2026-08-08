/**
 * Seed data for Orders
 * Mix of user orders and guest orders with various statuses
 */

import type { SeedOrder } from "./types";

// Helper to create dates in the past
const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

export const seedOrders: SeedOrder[] = [
  // Order 1: Delivered (user order with 2 items)
  {
    id: "order-1",
    code: "BB-1001",
    userId: "user-1",
    items: [
      {
        productId: "prod-1",
        productName: "Emerald Satin Abaya",
        productSlug: "emerald-satin-abaya",
        quantity: 1,
        price: 369000,
        thumbnail: "https://placehold.co/800x800/10b981/ffffff?text=Emerald+Abaya",
      },
      {
        productId: "prod-7",
        productName: "Gold Filigree Earrings",
        productSlug: "gold-filigree-earrings",
        quantity: 1,
        price: 150000,
        thumbnail: "https://placehold.co/800x800/eab308/ffffff?text=Gold+Earrings",
      },
    ],
    itemsTotal: 519000,
    shippingTotal: 7500,
    discount: 0,
    grandTotal: 526500,
    status: "delivered",
    address: {
      id: "addr-1-1",
      label: "Home",
      fullName: "Fatima Khan",
      mobile: "9123456789",
      addressLine1: "Flat 304, Aisha Apartments",
      addressLine2: "Nagpada Junction",
      landmark: "Near Agripada Police Station",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400008",
      isDefault: true,
    },
    notes: "Please call before delivery",
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    paymentId: "pay_test_1001",
    createdAt: daysAgo(55),
  },

  // Order 2: Delivered (user order with 1 item)
  {
    id: "order-2",
    code: "BB-1002",
    userId: "user-2",
    items: [
      {
        productId: "prod-4",
        productName: "Royal Oud Attar",
        productSlug: "royal-oud-attar",
        quantity: 2,
        price: 192000,
        thumbnail: "https://placehold.co/800x800/f59e0b/ffffff?text=Oud+Attar",
      },
    ],
    itemsTotal: 384000,
    shippingTotal: 6000,
    discount: 0,
    grandTotal: 390000,
    status: "delivered",
    address: {
      id: "addr-2-1",
      label: "Home",
      fullName: "Ayesha Patel",
      mobile: "9234567890",
      addressLine1: "201, Zara Heights",
      addressLine2: "Dongri Street",
      landmark: "Opposite Makhdoom Shah Baba Dargah",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400009",
      isDefault: true,
    },
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    paymentId: "pay_test_1002",
    createdAt: daysAgo(48),
  },

  // Order 3: Shipped (guest order with 3 prayer items)
  {
    id: "order-3",
    code: "BB-1003",
    userId: null, // Guest order
    items: [
      {
        productId: "prod-10",
        productName: "Velvet Prayer Mat",
        productSlug: "velvet-prayer-mat",
        quantity: 1,
        price: 144000,
        thumbnail: "https://placehold.co/800x800/0ea5e9/ffffff?text=Prayer+Mat",
      },
      {
        productId: "prod-11",
        productName: "Wooden Tasbih (99 Beads)",
        productSlug: "wooden-tasbih-99-beads",
        quantity: 2,
        price: 45000,
        thumbnail: "https://placehold.co/800x800/0ea5e9/ffffff?text=Tasbih",
      },
      {
        productId: "prod-12",
        productName: "Embroidered Quran Cover",
        productSlug: "quran-cover-embroidered",
        quantity: 1,
        price: 65000,
        thumbnail: "https://placehold.co/800x800/0ea5e9/ffffff?text=Quran+Cover",
      },
    ],
    itemsTotal: 299000,
    shippingTotal: 9000,
    discount: 0,
    grandTotal: 308000,
    status: "shipped",
    address: {
      id: "guest-addr-1",
      label: "Home",
      fullName: "Zara Ibrahim",
      mobile: "9456789012",
      addressLine1: "305, Al-Karim Building",
      addressLine2: "Tardeo Road",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400034",
      isDefault: true,
    },
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    paymentId: "pay_test_1003",
    createdAt: daysAgo(20),
  },

  // Order 4: Processing (user order, pending tracking)
  {
    id: "order-4",
    code: "BB-1004",
    userId: "user-3",
    items: [
      {
        productId: "prod-8",
        productName: "Emerald Stone Necklace",
        productSlug: "emerald-stone-necklace",
        quantity: 1,
        price: 256000,
        thumbnail: "https://placehold.co/800x800/eab308/ffffff?text=Emerald+Necklace",
      },
    ],
    itemsTotal: 256000,
    shippingTotal: 6000,
    discount: 0,
    grandTotal: 262000,
    status: "processing",
    address: {
      id: "addr-3-1",
      label: "Home",
      fullName: "Mariam Shaikh",
      mobile: "9567890123",
      addressLine1: "12, Husaini Building",
      addressLine2: "Mohammed Ali Road",
      landmark: "Near Minara Masjid",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400003",
      isDefault: true,
    },
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    paymentId: "pay_test_1004",
    createdAt: daysAgo(2),
  },

  // Order 5: Processing (guest order, pending tracking)
  {
    id: "order-5",
    code: "BB-1005",
    userId: null, // Guest order
    items: [
      {
        productId: "prod-6",
        productName: "Sandalwood Amber Attar",
        productSlug: "sandalwood-amber-attar",
        quantity: 1,
        price: 153000,
        thumbnail: "https://placehold.co/800x800/f59e0b/ffffff?text=Sandalwood+Amber",
      },
      {
        productId: "prod-9",
        productName: "Pearl Jhumka Set",
        productSlug: "pearl-jhumka-set",
        quantity: 1,
        price: 220000,
        thumbnail: "https://placehold.co/800x800/eab308/ffffff?text=Pearl+Jhumka",
      },
    ],
    itemsTotal: 373000,
    shippingTotal: 7000,
    discount: 0,
    grandTotal: 380000,
    status: "processing",
    address: {
      id: "guest-addr-2",
      label: "Office",
      fullName: "Rehana Ahmed",
      mobile: "9678901234",
      addressLine1: "Office 402, Trade Centre",
      addressLine2: "Kalbadevi Road",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400002",
      isDefault: false,
    },
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    paymentId: "pay_test_1005",
    createdAt: daysAgo(1),
  },
];
