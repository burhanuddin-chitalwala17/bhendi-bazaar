/**
 * Admin Abandoned Carts Page
 * View and track abandoned shopping carts
 */

"use client";

import { useAsyncData } from "@/hooks/core/useAsyncData";
import { useMutation } from "@/hooks/core/useMutation";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, Column } from "@/admin/data-table";
import { ShoppingCart, Mail, Eye, RefreshCw } from "lucide-react";
import { adminCartService } from "@/services/admin/cartService";
import type { AbandonedCart, AbandonedCartFilters } from "@/domain/admin";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "@/components/shared/PriceDisplay";

export default function AdminAbandonedCartsPage() {
  const [filters, setFilters] = useState<AbandonedCartFilters>({
    page: 1,
    limit: 20,
    minDays: 1,
  });

  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);

  const {
    data,
    loading: isLoading,
    error,
    refetch,
  } = useAsyncData(() => adminCartService.getAbandonedCarts(filters), {
    refetchDependencies: [filters],
  });

  const { mutate: sendReminder, isLoading: isSendingReminder } = useMutation(
    adminCartService.sendReminder,
    {
      successMessage: "Reminder sent successfully!",
      onSuccess: () => refetch(),
    }
  );

  const handleRefresh = () => {
    toast.info("Refreshing carts...");
    refetch().then(() => toast.success("Carts refreshed successfully!"));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const columns: Column<AbandonedCart>[] = [
    {
      key: "userName",
      label: "Customer",
      render: (cart) => (
        <div>
          <p className="font-medium">{cart.userName || "Guest"}</p>
          <p className="text-sm text-gray-500">{cart.userEmail}</p>
        </div>
      ),
    },
    {
      key: "itemsCount",
      label: "Items",
      render: (cart) => (
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-gray-400" />
          <span className="font-semibold">{cart.itemsCount}</span>
        </div>
      ),
    },
    {
      key: "totalValue",
      label: "Cart Value",
      sortable: true,
      render: (cart) => (
        <span className="font-semibold text-emerald-600">
          {formatCurrency(cart.totalValue)}
        </span>
      ),
    },
    {
      key: "daysSinceUpdate",
      label: "Abandoned",
      render: (cart) => (
        <div>
          <p className="font-medium">
            {cart.daysSinceUpdate} {cart.daysSinceUpdate === 1 ? "day" : "days"}{" "}
            ago
          </p>
          <p className="text-xs text-gray-500">
            {new Date(cart.updatedAt).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (cart) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedCart(cart)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View cart details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => sendReminder(cart.id)}
            disabled={isSendingReminder}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Send reminder email"
          >
            <Mail className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader
          overline="Abandoned Carts"
          title="View and track abandoned shopping carts"
        />
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
            className="rounded-full text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
          <div className="rounded-full text-[0.7rem] font-semibold uppercase tracking-[0.2em]">
            <span className="text-muted-foreground">Total Value</span>
            <PriceDisplay price={data?.totalValue || 0} size="lg" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Days Abandoned
            </label>
            <select
              value={filters.minDays}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  minDays: parseInt(e.target.value),
                  page: 1,
                })
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="1">1+ days</option>
              <option value="2">2+ days</option>
              <option value="3">3+ days</option>
              <option value="7">7+ days</option>
              <option value="14">14+ days</option>
              <option value="30">30+ days</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Cart Value
            </label>
            <select
              value={filters.minValue || 0}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  minValue: parseInt(e.target.value) || undefined,
                  page: 1,
                })
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="0">All Values</option>
              <option value="500">₹500+</option>
              <option value="1000">₹1,000+</option>
              <option value="2000">₹2,000+</option>
              <option value="5000">₹5,000+</option>
            </select>
          </div>
        </div>
      </div>

      {/* Carts Table */}
      <DataTable
        data={data?.carts || []}
        columns={columns}
        totalPages={data?.totalPages || 1}
        currentPage={filters.page || 1}
        totalItems={data?.total || 0}
        onPageChange={(page) => setFilters({ ...filters, page })}
        onSort={(key, order) =>
          setFilters({ ...filters, sortBy: key as any, sortOrder: order })
        }
        isLoading={isLoading}
      />

      {/* Cart Details Modal */}
      {selectedCart && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedCart(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Cart Details</h2>
              <button
                onClick={() => setSelectedCart(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Customer Info */}
              <div className="border-b pb-4">
                <h3 className="font-semibold text-gray-900 mb-2">Customer</h3>
                <p className="text-sm">
                  <span className="text-gray-600">Name:</span>{" "}
                  {selectedCart.userName || "N/A"}
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Email:</span>{" "}
                  {selectedCart.userEmail || "N/A"}
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Abandoned:</span>{" "}
                  {selectedCart.daysSinceUpdate} days ago
                </p>
              </div>

              {/* Cart Items */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Cart Items ({selectedCart.itemsCount})
                </h3>
                <div className="space-y-2">
                  {(selectedCart.items as any[]).map((item: any, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <img
                        src={item.thumbnail}
                        alt={item.name}
                        className="w-16 aspect-[3/4] object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-gray-600">
                          Qty: {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">Total Value:</span>
                  <span className="font-bold text-2xl text-emerald-600">
                    {formatCurrency(selectedCart.totalValue)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => sendReminder(selectedCart.id)}
                  disabled={isSendingReminder}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  {isSendingReminder ? "Sending..." : "Send Reminder Email"}
                </button>
                <button
                  onClick={() => setSelectedCart(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

