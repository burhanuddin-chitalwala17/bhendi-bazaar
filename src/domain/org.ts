// src/domain/org.ts

export interface Org {
  id: string;
  code: string;
  name: string;
  email: string;
  phone?: string;
  contactPerson?: string;

  defaultPincode: string;
  defaultCity: string;
  defaultState: string;
  defaultAddress?: string;

  businessName?: string;
  gstNumber?: string;
  panNumber?: string;

  isActive: boolean;
  isVerified: boolean;

  description?: string;
  logoUrl?: string;

  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrgInput {
  code: string;
  name: string;
  email: string;
  phone?: string;
  contactPerson?: string;

  defaultPincode: string;
  defaultCity: string;
  defaultState: string;
  defaultAddress?: string;

  businessName?: string;
  gstNumber?: string;
  panNumber?: string;

  isActive: boolean;
  description?: string;
}

export interface UpdateOrgInput extends Partial<CreateOrgInput> {
  id: string;
}

export interface OrgWithStats extends Org {
  productCount: number;
  activeProductCount?: number;
  totalStock: number;
  totalRevenue?: number;
}
