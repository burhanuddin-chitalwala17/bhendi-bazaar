/**
 * Shipping Utility Functions
 * 
 * Helper functions for shipping-related calculations and formatting.
 */

import type { CartItem } from "@/domain/cart";
import { ShippingGroup } from "@/domain/shipping";
/**
 * Calculate total weight from cart items
 * @param items - Cart items
 * @param defaultWeightPerItem - Default weight in kg if product weight not specified
 * @returns Total weight in kg
 */
export function calculateCartWeight(
  items: CartItem[],
  defaultWeightPerItem: number = 0.5
): number {
  const totalWeight = items.reduce((total, item) => {
    // Use product weight if available, otherwise use default
    // const itemWeight = item.weight || defaultWeightPerItem;
    const itemWeight = 0.5; // defaultWeightPerItem;
    return total + itemWeight * item.quantity;
  }, 0);

  // Round to 2 decimal places
  return Math.round(totalWeight * 100) / 100;
}

/**
 * Format delivery estimate
 */
export function formatDeliveryEstimate(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

/**
 * Get estimated delivery date
 */
export function getEstimatedDeliveryDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Format delivery date
 */
export function formatDeliveryDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Validate Indian pincode
 */
/**
 * Get shipping method display name
 */
export function getShippingMethodName(mode: string): string {
  const names: Record<string, string> = {
    STANDARD: "Standard Delivery",
    EXPRESS: "Express Delivery",
    ECONOMY: "Economy Delivery",
    SAME_DAY: "Same Day Delivery",
  };
  return names[mode] || mode;
}


/**
 * Group cart items by shipping origin (org + pincode)
 * Items from the same org + pincode = one shipment
 */
export function groupItemsByOrigin(items: CartItem[]): ShippingGroup[] {
  const groupMap = new Map<string, ShippingGroup>();

  items.forEach(item => {
    // Create unique key: orgId + pincode
    const groupId = `${item.org.id}-${item.shippingFromPincode}`;

    if (!groupMap.has(groupId)) {
      // Create new group
      groupMap.set(groupId, {
        groupId,
        orgId: item.org.id,
        orgName: item.org.name,
        orgCode: item.org.code,
        fromPincode: item.shippingFromPincode,
        fromCity: item.org.defaultCity,
        fromState: item.org.defaultState,
        items: [],
        totalWeight: 0,
        itemsTotal: 0,
        rates: [],
        selectedRate: null,
        isLoading: false,
        error: null,
        serviceable: false,
      });
    }

    // Add item to group
    const group = groupMap.get(groupId);
    if (!group) {
      throw new Error(`Group not found for ID: ${groupId}`);
    }
    group.items.push(item);

    // Update totals
    const itemPrice = item.salePrice ?? item.price;
    group.itemsTotal += itemPrice * item.quantity;
    group.totalWeight += item.weight * item.quantity;
  });

  return Array.from(groupMap.values());
}

/**
 * Get total shipping cost across all groups
 */
export function calculateTotalShipping(groups: any[]): number {
  return groups.reduce((total, group) => {
    return total + (group.selectedRate?.rate ?? 0);
  }, 0);
}

/**
 * Check if all groups have selected shipping rates
 */
export function areAllGroupsReady(groups: any[]): boolean {
  return groups.every(group =>
    group.selectedRate !== null &&
    group.serviceable &&
    !group.loading &&
    !group.error
  );
}

/**
 * Get unique orgs from groups
 */
export function getUniqueOrgs(groups: any[]): Array<{
  id: string;
  name: string;
  itemCount: number;
}> {
  const orgMap = new Map<string, { name: string; count: number }>();

  groups.forEach(group => {
    if (!orgMap.has(group.orgId)) {
      orgMap.set(group.orgId, {
        name: group.orgName,
        count: 0,
      });
    }
    const org = orgMap.get(group.orgId)!;
    org.count += group.items.length;
  });

  return Array.from(orgMap.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    itemCount: data.count,
  }));
}

