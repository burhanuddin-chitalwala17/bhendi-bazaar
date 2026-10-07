// src/domain/org.ts

export type { OrgSummary } from "@server/catalog/org.types";

export interface Org {
  id: string;
  code: string;
  name: string;
  email: string;
  phone?: string;
  contactPerson?: string;


  businessName?: string;
  gstNumber?: string;
  panNumber?: string;

  isActive: boolean;
  isBlocked: boolean;
  isVerified: boolean;

  description?: string;
  logoUrl?: string;

  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

// Declared server-side so `server/` need not import from `src/`; re-exported here so
// client code keeps one import path for them.
export type { CreateOrgInput, UpdateOrgInput } from "@server/catalog/org.types";

export interface OrgWithStats extends Org {
  productCount: number;
  activeProductCount?: number;
  totalStock: number;
  totalRevenue?: number;
}
