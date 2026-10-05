/** Pickup locations as the console and the org portal see them. */

export interface OrgLocation {
  id: string;
  name: string;
  contactName: string;
  contactPhone: string;
  isActive: boolean;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  /** Products with units physically here — what blocks deletion (R8). */
  stockedProducts: number;
  /** Parcels that name this location as their origin — also blocks deletion (R8). */
  shipmentCount: number;
}

export interface OrgLocationWrite {
  name: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  isActive?: boolean;
}
