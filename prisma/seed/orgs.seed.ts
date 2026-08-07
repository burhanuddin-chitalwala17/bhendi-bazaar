/**
 * Seed data for Orgs
 */

import type { SeedOrg } from "./types";

export const seedOrgs: SeedOrg[] = [
  {
    id: "org-1",
    code: "SEL-001",
    name: "Bhendi Bazaar Traders",
    email: "contact@bhendibazaartraders.com",
    phone: "9876543210",
    contactPerson: "Ahmed Khan",
    defaultPincode: "400003",
    defaultCity: "Mumbai",
    defaultState: "Maharashtra",
    defaultAddress: "Shop No. 45, Bhendi Bazaar, Mumbai",
    businessName: "Bhendi Bazaar Traders Pvt. Ltd.",
    gstNumber: "27AABCU9603R1ZX",
    panNumber: "AABCU9603R",
    isActive: true,
    isVerified: true,
    description: "Leading wholesaler and retailer of traditional Islamic clothing and accessories in Mumbai. Established 1985.",
    logoUrl: "https://placehold.co/200x200/10b981/ffffff?text=BBT",
  },
  {
    id: "org-2",
    code: "SEL-002",
    name: "Islamic Essentials Hub",
    email: "info@islamicessentials.in",
    phone: "9876543211",
    contactPerson: "Fatima Sheikh",
    defaultPincode: "400001",
    defaultCity: "Mumbai",
    defaultState: "Maharashtra",
    defaultAddress: "Unit 12, Islamic Market Complex, Mumbai",
    businessName: "Islamic Essentials Hub",
    gstNumber: "27XYZAB1234M1N2",
    panNumber: "XYZAB1234M",
    isActive: true,
    isVerified: true,
    description: "Premium supplier of attars, prayer essentials, and traditional jewelry. Quality products with authentic sourcing.",
    logoUrl: "https://placehold.co/200x200/0ea5e9/ffffff?text=IEH",
  },
];