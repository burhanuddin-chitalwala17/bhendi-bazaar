/**
 * Client-side domain types for Profile
 *
 * These types are used on the client-side (components, hooks).
 * They mirror the API response structure and are used for type safety.
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
  label?: string;
  notes?: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  profilePic: string | null;
  addresses: DeliveryAddress[];
}

// User fields relevant to profile editing
export interface User {
  id: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
}

// Aggregate root - combines user + profile for this context
export interface ProfileData {
  user: User;
  profile: UserProfile;
}

// Update inputs for client-side forms
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