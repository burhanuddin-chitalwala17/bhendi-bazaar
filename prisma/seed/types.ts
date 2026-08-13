/**
 * Type definitions for seed data
 */

export interface SeedUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // Will be hashed in seed script
  passwordPlain: string; // For reference only
  platformRole: "USER" | "ADMIN";
  mobile: string;
  isEmailVerified: boolean;
  profile: {
    addresses: SeedAddress[];
    profilePic: string | null;
  };
}

// ... existing code ...

export interface SeedOrg {
  id: string;
  code: string;
  name: string;
  email: string;
  phone?: string;
  contactPerson?: string;
  /** Seeded as the org's one pickup location (Address + OrgAddress rows). */
  pickup: { address: string; city: string; state: string; pincode: string };
  businessName?: string;
  gstNumber?: string;
  panNumber?: string;
  isActive: boolean;
  isVerified: boolean;
  description?: string;
  logoUrl?: string;
}

export interface SeedAddress {
  id: string;
  label: string;
  fullName: string;
  mobile: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export type SeedCategoryAccent = "EMERALD" | "BLUE" | "PURPLE" | "PINK" | "ORANGE" | "YELLOW" | "RED" | "GRAY";

export interface SeedCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  heroImage: string;
  accent: SeedCategoryAccent;
  order: number;
}

export interface SeedProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  salePrice?: number;
  currency: "INR";
  orgId: string;
  categoryId: string;
  tags: string[];
  flags: string[];
  rating: number;
  reviewsCount: number;
  images: string[];
  thumbnail: string;
  /** Optional YouTube id, appended to the gallery after the photographs (ADR-0017). */
  video?: string;
  sizes: string[];
  colors: string[];
  stock: number; // seeded as a ProductStock row at the org's pickup location
  sku?: string;
  lowStockThreshold: number;
  weight?: number; // ⭐ Weight in kg
}

export interface SeedOrder {
  id: string;
  code: string;
  userId: string | null;
  items: OrderItem[];
  itemsTotal: number; // ⭐ Changed from totals.subtotal
  shippingTotal: number; // ⭐ New field
  discount: number; // ⭐ Changed from totals.discount
  grandTotal: number; // ⭐ Changed from totals.total
  status: "processing" | "packed" | "shipped" | "delivered";
  address: SeedAddress;
  notes?: string;
  paymentMethod: string;
  paymentStatus: "pending" | "paid" | "failed";
  paymentId?: string;
  estimatedDelivery?: Date;
  createdAt: Date;
}

export interface SeedShipment {
  id: string;
  code: string; // "BB-1001-SH1"
  orderId: string;
  items: OrderItem[]; // Items in this specific shipment
  orgId: string;
  fromPincode: string;
  fromCity: string;
  fromState: string;
  shippingCost: number;
  shippingProviderId?: string;
  trackingNumber?: string;
  courierName?: string;
  trackingUrl?: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "failed";
  packageWeight?: number;
  estimatedDelivery?: Date;
  createdAt: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productSlug: string;
  quantity: number;
  price: number; // paise
  salePrice?: number; // paise
  thumbnail: string;
}

export interface SeedReview {
  id: string;
  productId: string;
  userId: string | null;
  rating: number;
  title: string;
  comment: string;
  userName: string;
  isVerified: boolean;
  isApproved: boolean;
  createdAt: Date;
}

export interface SeedCart {
  id: string;
  userId: string;
  items: OrderItem[];
  updatedAt: Date;
}

export interface SeedShippingProvider {
  id: string;
  code: string;
  name: string; // Display name: "Shiprocket", "Delhivery"
  description?: string; // Provider description

  priority: number; // Higher number = higher priority

  // Authentication & Connection Status
  isConnected: boolean; // Is account connected?
  connectedAt?: Date; // When was it connected?
  connectedBy?: string; // Admin user ID who connected it
  connectionType: "email_password" | "api_key" | "oauth"; // [ 'email_password', 'api_key', 'oauth' ]
  lastAuthAt?: Date; // Last successful authentication
  authError?: string; // Last auth error message

  // Encrypted sensitive data
  authToken?: string; // Encrypted JWT token
  tokenExpiresAt?: Date; // Token expiry timestamp

  // Account info (includes encrypted password)
  accountInfo?: Record<string, string | number>; 
  
  // Capabilities
  paymentOptions: string[]; // ['prepaid', 'cod']
  deliveryModes: string[]; // ['air', 'surface']
  features?: Record<string, boolean>; // {tracking: true, label: true, scheduling: true}

  // Metadata
  logoUrl?: string; // Provider logo
  websiteUrl?: string; // Provider website

  createdAt: Date;
  updatedAt: Date;

}
