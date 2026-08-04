/**
 * Admin Cart Management Domain Types
 */

export interface AbandonedCart {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  items: any; // CartItem[]
  itemsCount: number;
  totalValue: number;
  createdAt: Date;
  updatedAt: Date;
  daysSinceUpdate: number;
}

export interface AbandonedCartFilters {
  minValue?: number;
  minDays?: number; // Minimum days since last update
  page?: number;
  limit?: number;
  sortBy?: "updatedAt" | "totalValue";
  sortOrder?: "asc" | "desc";
}

export interface AbandonedCartResult {
  carts: AbandonedCart[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalValue: number; // Sum of all abandoned cart values
}


