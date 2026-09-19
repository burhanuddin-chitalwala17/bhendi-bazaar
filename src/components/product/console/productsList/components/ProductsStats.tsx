// src/components/admin/products/productsContainer/components/ProductsStats.tsx

import { Card, CardContent } from "@/components/ui/card";
import {
  Package,
  AlertTriangle,
  XCircle,
  Star,
  DollarSign,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { ProductStats } from "../../types";

interface ProductsStatsProps {
  stats: ProductStats;
}

export function ProductsStats({ stats }: ProductsStatsProps) {
  const statCards: Array<{
    label: string;
    value: string;
    note?: string;
    icon: typeof Package;
    color: string;
    bgColor: string;
  }> = [
    {
      // "On Sale", not "Total": every figure on this row excludes withdrawn products
      // (ADR-0029 D12), and a label that did not say so would be the ambiguous one.
      label: "On Sale",
      value: stats.totalProducts.toLocaleString(),
      note:
        stats.withdrawnProducts > 0
          ? `+ ${stats.withdrawnProducts.toLocaleString()} withdrawn`
          : undefined,
      icon: Package,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      label: "Low Stock",
      value: stats.lowStockProducts.toLocaleString(),
      icon: AlertTriangle,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      label: "Out of Stock",
      value: stats.outOfStockProducts.toLocaleString(),
      icon: XCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      label: "Featured",
      value: stats.featuredProducts.toLocaleString(),
      icon: Star,
      color: "text-accent-foreground",
      bgColor: "bg-accent/25",
    },
    {
      label: "Inventory Value",
      value: formatCurrency(stats.totalInventoryValue),
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {statCards.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <h3 className="text-2xl font-bold mt-2">{stat.value}</h3>
                {stat.note && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.note}
                  </p>
                )}
              </div>
              <div className={`p-3 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
