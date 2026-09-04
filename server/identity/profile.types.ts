/**
 * Server-side domain types for Profile
 * 
 * These types are used exclusively on the server-side (services, repositories).
 * They mirror the database schema and contain server-specific logic.
 */
export interface DeliveryAddress {
  id: string;
  fullName: string;
  mobile: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string; 
  state: string;
  pincode: string;
  country: string;
  /** The person's own name for this address ("Home", "Office"). */
  label?: string;
  /** Delivery instructions. Top-level since PR-41 — the old `metadata` bag is gone. */
  notes?: string;
}

export interface ServerUserProfile {
  id: string;
  userId: string;
  profilePic: string | null;
  addresses: DeliveryAddress[];
}

export interface ServerUser {
  id: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
}

export interface ServerProfileData {
  user: ServerUser;
  profile: ServerUserProfile;
}

export interface UpdateProfileInput {
  // User fields
  name?: string;
  email?: string;
  mobile?: string;
  // Profile fields
  addresses?: DeliveryAddress[];
  profilePic?: string | null;
  /** Re-authentication, required only when `email` differs from the stored one. */
  currentPassword?: string;
}

