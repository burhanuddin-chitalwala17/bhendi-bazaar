import { productTeamService } from "@server/catalog/product-team.service";
import type { ProductTeamEditDto } from "@server/catalog/product-team";

/** The shop's read of the team's saves on one of its products (product-form D13). */
export const productTeamDAL = {
  history(productId: string, orgId: string): Promise<ProductTeamEditDto[]> {
    return productTeamService.history(productId, orgId);
  },
};
