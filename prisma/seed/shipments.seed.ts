/**
 * Seed data for Shipments
 * Each order can have multiple shipments from different orgs/warehouses
 */

import type { SeedShipment } from "./types";
import { seedOrgs } from "./orgs.seed";

// Helper to create dates in the past
const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const addDays = (date: Date, days: number): Date => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
};

export const seedShipments: SeedShipment[] = [
  // Shipments for order BB-1001 (2 items, 1 shipment - same org)
  {
    id: "shipment-1",
    code: "BB-1001-SH1",
    orderId: "order-1",
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
    orgId: seedOrgs[0].id, // First org
    fromPincode: seedOrgs[0].defaultPincode,
    fromCity: seedOrgs[0].defaultCity,
    fromState: seedOrgs[0].defaultState,
    shippingCost: 7500,
    trackingNumber: "BD1234567890123",
    courierName: "Blue Dart Surface",
    trackingUrl: "https://www.bluedart.com/tracking/BD1234567890123",
    status: "delivered",
    packageWeight: 0.42, // 0.4 + 0.02 kg
    estimatedDelivery: daysAgo(50),
    createdAt: daysAgo(55),
  },

  // Shipments for order BB-1002 (1 item, 1 shipment)
  {
    id: "shipment-2",
    code: "BB-1002-SH1",
    orderId: "order-2",
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
    orgId: seedOrgs[1].id, // Second org
    fromPincode: seedOrgs[1].defaultPincode,
    fromCity: seedOrgs[1].defaultCity,
    fromState: seedOrgs[1].defaultState,
    shippingCost: 6000,
    trackingNumber: "DL9876543210987",
    courierName: "Delhivery Surface",
    trackingUrl: "https://www.delhivery.com/track/package/DL9876543210987",
    status: "delivered",
    packageWeight: 0.1, // 0.05 x 2
    estimatedDelivery: daysAgo(43),
    createdAt: daysAgo(48),
  },

  // Shipments for order BB-1003 (3 items from same org)
  {
    id: "shipment-3",
    code: "BB-1003-SH1",
    orderId: "order-3",
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
    orgId: seedOrgs[0].id,
    fromPincode: seedOrgs[0].defaultPincode,
    fromCity: seedOrgs[0].defaultCity,
    fromState: seedOrgs[0].defaultState,
    shippingCost: 9000,
    trackingNumber: "BD2345678901234",
    courierName: "Blue Dart Surface",
    trackingUrl: "https://www.bluedart.com/tracking/BD2345678901234",
    status: "shipped",
    packageWeight: 0.81, // 0.6 + 0.06 + 0.15
    estimatedDelivery: addDays(daysAgo(20), 5),
    createdAt: daysAgo(20),
  },

  // Shipments for order BB-1004 (1 item, pending tracking)
  {
    id: "shipment-4",
    code: "BB-1004-SH1",
    orderId: "order-4",
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
    orgId: seedOrgs[1].id,
    fromPincode: seedOrgs[1].defaultPincode,
    fromCity: seedOrgs[1].defaultCity,
    fromState: seedOrgs[1].defaultState,
    shippingCost: 6000,
    status: "pending", // ⭐ Awaiting manual tracking update
    packageWeight: 0.08,
    estimatedDelivery: addDays(new Date(), 7),
    createdAt: daysAgo(2),
  },

  // Shipments for order BB-1005 (Guest order, 2 items, pending)
  {
    id: "shipment-5",
    code: "BB-1005-SH1",
    orderId: "order-5",
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
    orgId: seedOrgs[0].id,
    fromPincode: seedOrgs[0].defaultPincode,
    fromCity: seedOrgs[0].defaultCity,
    fromState: seedOrgs[0].defaultState,
    shippingCost: 7000,
    status: "pending", // ⭐ Awaiting manual tracking update
    packageWeight: 0.08, // 0.05 + 0.03
    estimatedDelivery: addDays(new Date(), 7),
    createdAt: daysAgo(1),
  },
];
