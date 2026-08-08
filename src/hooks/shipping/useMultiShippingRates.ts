// src/hooks/shipping/useMultiShippingRates.ts

import { useState, useCallback, useMemo } from "react";
import { shippingService } from "@/services/shippingService";
import type { CartItem } from "@/domain/cart";
import type { ShippingGroup, ShippingRate, GetShippingRatesRequest } from "@/domain/shipping";
import { calculateTotalShipping, areAllGroupsReady } from "@/utils/shipping";
import { readApiError } from "@/lib/api-error";

export interface UseMultiShippingRatesReturn {
  // Data
  groups: ShippingGroup[];
  totalShippingCost: number;
  isAllGroupsReady: boolean;
  
  // State
  isLoading: boolean;
  /** Set when the basket cannot be allocated at all — e.g. an item sold out. */
  allocationError: string | null;
  
  // Actions
  fetchAllRates: (items: CartItem[], toPincode: string) => Promise<void>;
  selectRateForGroup: (groupId: string, rate: ShippingRate) => void;
  reset: () => void;
}

export function useMultiShippingRates(): UseMultiShippingRatesReturn {
  const [groups, setGroups] = useState<ShippingGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);

  /**
   * The server decides which parcels the basket becomes (stock-locations R5/R10):
   * groups arrive allocated per pickup location, each with a coherent origin —
   * grouping is no longer inferred client-side from org + pincode.
   */
  const allocateParcels = useCallback(
    async (items: CartItem[], toPincode: string): Promise<ShippingGroup[]> => {
      const response = await fetch("/api/checkout/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            size: item.size || undefined,
            color: item.color || undefined,
          })),
          destinationPincode: toPincode,
        }),
      });
      if (!response.ok) throw await readApiError(response);
      const data: {
        groups: Array<{
          groupId: string;
          orgId: string;
          orgName: string;
          orgCode: string;
          locationName: string;
          fromPincode: string;
          fromCity: string;
          fromState: string;
          items: Array<{ productId: string; quantity: number; size?: string; color?: string }>;
          totalWeight: number;
          billableWeightKg: number;
        }>;
      } = await response.json();

      const cartItemFor = (line: { productId: string; size?: string; color?: string }) =>
        items.find(
          (item) =>
            item.productId === line.productId &&
            (item.size || undefined) === line.size &&
            (item.color || undefined) === line.color
        );

      return data.groups.map((group) => {
        const groupItems = group.items
          .map((line) => {
            const item = cartItemFor(line);
            return item ? { ...item, quantity: line.quantity } : null;
          })
          .filter((item): item is CartItem => item !== null);
        return {
          groupId: group.groupId,
          orgId: group.orgId,
          orgName: group.orgName,
          orgCode: group.orgCode,
          locationName: group.locationName,
          fromPincode: group.fromPincode,
          fromCity: group.fromCity,
          fromState: group.fromState,
          items: groupItems,
          totalWeight: group.totalWeight,
          billableWeightKg: group.billableWeightKg,
          itemsTotal: groupItems.reduce(
            (sum, item) => sum + (item.salePrice ?? item.price) * item.quantity,
            0
          ),
          rates: [],
          selectedRate: null,
          isLoading: false,
          error: null,
          serviceable: false,
        };
      });
    },
    []
  );

  // Fetch rates for all groups
  const fetchAllRates = useCallback(
    async (items: CartItem[], toPincode: string) => {
      if (items.length === 0) {
        setGroups([]);
        return;
      }
      
      setIsLoading(true);
      setAllocationError(null);

      let initialGroups: ShippingGroup[];
      try {
        initialGroups = await allocateParcels(items, toPincode);
      } catch (error) {
        setGroups([]);
        setAllocationError(
          error instanceof Error ? error.message : "Could not plan your parcels"
        );
        setIsLoading(false);
        return;
      }

      try {
        // Fetch rates for each group in parallel
        const updatedGroups = await Promise.all(
          initialGroups.map(async (group) => {
            // Mark group as loading
            const updatedGroup = { ...group, isLoading: true };
            
            try {
              const request: GetShippingRatesRequest = {
                fromPincode: group.fromPincode,
                toPincode,
                // Quoted on the billable weight — whole kilograms, rounded up —
                // never on the raw sum (product-weight-and-rates).
                weight: group.billableWeightKg ?? Math.max(1, Math.ceil(group.totalWeight)),
                cod: false,
              };
              
              const response = await shippingService.getRates(request);
              
              return {
                ...updatedGroup,
                rates: response.rates,
                selectedRate: response.defaultRate ?? response.rates[0] ?? null,
                serviceable: response.success && response.rates.length > 0,
                isLoading: false,
                error: null,
              };
            } catch (error) {
              return {
                ...updatedGroup,
                isLoading: false,
                error: error instanceof Error ? error.message : "Failed to fetch rates",
                serviceable: false,
              };
            }
          })
        );
        
        setGroups(updatedGroups);
      } finally {
        setIsLoading(false);
      }
    },
    [allocateParcels]
  );
  
  // Select rate for a specific group
  const selectRateForGroup = useCallback((groupId: string, rate: ShippingRate) => {
    setGroups(prev => 
      prev.map(group => 
        group.groupId === groupId
          ? { ...group, selectedRate: rate }
          : group
      )
    );
  }, []);
  
  // Reset state
  const reset = useCallback(() => {
    setGroups([]);
    setIsLoading(false);
    setAllocationError(null);
  }, []);
  
  // Calculate derived values
  const totalShippingCost = calculateTotalShipping(groups);
  const isAllGroupsReady = areAllGroupsReady(groups);
  
  return {
    groups,
    totalShippingCost,
    isAllGroupsReady,
    isLoading,
    allocationError,
    fetchAllRates,
    selectRateForGroup,
    reset,
  };
}
