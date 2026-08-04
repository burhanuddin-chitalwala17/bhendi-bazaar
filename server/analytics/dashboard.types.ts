/**
 * Admin Dashboard Domain Types
 */

export interface DashboardStats {
  revenue: {
    today: number;
    week: number;
    month: number;
    year: number;
  };
  orders: {
    total: number;
    processing: number;
    packed: number;
    shipped: number;
    delivered: number;
    todayCount: number;
  };
  products: {
    total: number;
    lowStock: number;
    outOfStock: number;
  };
  customers: {
    total: number;
    active: number; // Active in last 30 days
    new: number; // New this month
  };
}

export interface RecentActivity {
  id: string;
  type: "order" | "user" | "review" | "product";
  title: string;
  description: string;
  timestamp: Date;
  metadata?: any;
}

export interface TopProduct {
  id: string;
  name: string;
  thumbnail: string;
  salesCount: number;
  revenue: number;
}

export interface RevenueChart {
  date: string; // YYYY-MM-DD
  revenue: number;
  orders: number;
}


