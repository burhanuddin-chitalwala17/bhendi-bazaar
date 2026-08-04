/**
 * Admin Order Details Page
 * View order details and update shipment tracking
 */

"use client";

import { use, useState } from "react";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { adminOrderApiClient } from "@/services/admin/orderApiClient";
import { ShipmentTrackingForm } from "@/components/admin/ShipmentTrackingForm";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { 
  Package, 
  MapPin, 
  CreditCard, 
  Truck,
  Calendar,
  User,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminOrderDetailsPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const resolvedParams = use(params);
  const { orderId } = resolvedParams;
  const [editingShipmentId, setEditingShipmentId] = useState<string | null>(null);

  const {
    data: order,
    loading,
    error,
    refetch,
  } = useAsyncData(
    () => adminOrderApiClient.getOrderById(orderId),
    {
      refetchDependencies: [orderId],
    }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "shipped":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Package className="w-5 h-5 text-gray-600" />;
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !order) {
    return <ErrorState message={error || "Order not found"} />;
  }

  const address = order.address as any;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SectionHeader
          overline="Order Details"
          title={`Order ${order.code}`}
        />
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium",
              order.paymentStatus === "paid"
                ? "bg-green-100 text-green-800"
                : order.paymentStatus === "failed"
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
            )}
          >
            {order.paymentStatus}
          </span>
          <span
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium",
              order.status === "confirmed"
                ? "bg-blue-100 text-blue-800"
                : order.status === "processing"
                ? "bg-orange-100 text-orange-800"
                : "bg-gray-100 text-gray-800"
            )}
          >
            {order.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Customer & Order Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">{address?.fullName || "Guest"}</p>
                 
                </div>
              </div>
              {address?.mobile && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <p>{address.mobile}</p>
                </div>
              )}
              {address?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <p>{address.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Delivery Address
            </h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p>{address?.addressLine1}</p>
              {address?.addressLine2 && <p>{address.addressLine2}</p>}
              <p>
                {address?.city}, {address?.state} {address?.pincode}
              </p>
              <p>{address?.country}</p>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Order Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Items Total</span>
                <span className="font-medium">
                  {formatCurrency((order as any).itemsTotal || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span className="font-medium">
                  {formatCurrency((order as any).shippingTotal || 0)}
                </span>
              </div>
              {(order as any).discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>
                    -{formatCurrency((order as any).discount)}
                  </span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between text-base font-semibold">
                <span>Grand Total</span>
                <span>{formatCurrency((order as any).grandTotal || 0)}</span>
              </div>
            </div>
          </div>

          {/* Order Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Order Date</span>
              <span className="font-medium">
                {new Date(order.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Method</span>
              <span className="font-medium">{order.paymentMethod || "N/A"}</span>
            </div>
            {order.paymentId && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Payment ID</span>
                <span className="font-mono">{order.paymentId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Shipments */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Truck className="w-6 h-6" />
            Shipments ({(order as any).shipments?.length || 0})
          </h3>

          {(order as any).shipments?.map((shipment: any) => (
            <div
              key={shipment.id}
              className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
            >
              {/* Shipment Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(shipment.status)}
                    <h4 className="text-lg font-semibold">{shipment.code}</h4>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      From: {shipment.fromCity}, {shipment.fromState}
                    </p>
                    <p className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Weight: {shipment.packageWeight}kg
                    </p>
                    <p className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Shipping Cost: {formatCurrency(shipment.shippingCost)}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium",
                    shipment.status === "shipped"
                      ? "bg-green-100 text-green-800"
                      : shipment.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
                  )}
                >
                  {shipment.status}
                </span>
              </div>

              {/* Items */}
              <div className="border-t pt-4">
                <h5 className="font-medium text-sm mb-2">Items</h5>
                <div className="space-y-2">
                  {shipment.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-700">
                        {item.productName} × {item.quantity}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(
                          (item.salePrice ?? item.price) * item.quantity
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tracking Info or Form */}
              {shipment.trackingNumber && editingShipmentId !== shipment.id ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-sm text-emerald-900">
                      Tracking Information
                    </h5>
                    <button
                      onClick={() => setEditingShipmentId(shipment.id)}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-emerald-100 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">AWB Number</span>
                      <span className="font-mono font-medium">
                        {shipment.trackingNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Courier</span>
                      <span className="font-medium">
                        {shipment.courierName}
                      </span>
                    </div>
                    {shipment.trackingUrl && (
                      <div className="pt-2">
                        <a
                          href={shipment.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 underline text-sm"
                        >
                          Track Shipment →
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-sm text-orange-700 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {shipment.trackingNumber ? 'Update Tracking' : 'Tracking Required - Update After Creating on Shiprocket'}
                    </h5>
                    {shipment.trackingNumber && (
                      <button
                        onClick={() => setEditingShipmentId(null)}
                        className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <ShipmentTrackingForm
                    shipmentId={shipment.id}
                    shipmentCode={shipment.code}
                    courierName={shipment.courierName}
                    existingTracking={shipment.trackingNumber ? {
                      trackingNumber: shipment.trackingNumber,
                      trackingUrl: shipment.trackingUrl || '',
                    } : undefined}
                    onSuccess={() => {
                      refetch();
                      setEditingShipmentId(null);
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
