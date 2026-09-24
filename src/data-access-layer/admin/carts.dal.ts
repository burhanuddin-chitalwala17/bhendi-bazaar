// DATA ACCESS LAYER FOR ABANDONED CARTS

import { cache } from "react";
import { adminCartService } from "@server/cart/admin.cart.service";
import type { AbandonedCartFilters, AbandonedCartResult } from "@server/cart/admin.cart.types";

/**
 * The console's abandoned-cart list, read on the server
 * ([ADR-0034](../../../docs/adr/0034-render-on-the-server-by-default.md)).
 */
class CartsDAL {
  list = cache(async (filters: AbandonedCartFilters): Promise<AbandonedCartResult> => {
    return adminCartService.getAbandonedCarts(filters);
  });
}

export const adminCartsDAL = new CartsDAL();
