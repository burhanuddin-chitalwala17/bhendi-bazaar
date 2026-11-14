"use client";

import { createContext, useContext, type ReactNode } from "react";

import { ALL_ON, type FeatureAccessDTO } from "@server/subscriptions/feature-access.types";

/**
 * What this shop may use of the paid features, given once by the org layout from the scope it already
 * read (feature-access D6), so every paid action deep in a screen draws its lock without a prop chain.
 * Outside an org layout (the admin acting for a shop) it reads all on: the server still refuses (D5).
 */
interface ShopPlan {
  shop: string;
  features: FeatureAccessDTO;
}

const PlanContext = createContext<ShopPlan>({ shop: "", features: ALL_ON });

export function ShopPlanProvider({ shop, features, children }: ShopPlan & { children: ReactNode }) {
  return <PlanContext.Provider value={{ shop, features }}>{children}</PlanContext.Provider>;
}

export function useShopPlan(): ShopPlan {
  return useContext(PlanContext);
}
