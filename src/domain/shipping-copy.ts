/** The words shipping shows a buyer: an estimate in days and a method's name (ADR-0067). */
export const DELIVERY_ESTIMATE_COPY = {
  sameDay: "Same day",
  tomorrow: "Tomorrow",
  inDays: (days: number) => `In ${days} days`,
} as const;

export const SHIPPING_METHOD_COPY: Record<string, string> = {
  STANDARD: "Standard Delivery",
  EXPRESS: "Express Delivery",
  ECONOMY: "Economy Delivery",
  SAME_DAY: "Same Day Delivery",
};
