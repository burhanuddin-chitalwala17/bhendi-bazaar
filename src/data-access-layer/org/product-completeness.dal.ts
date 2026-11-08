// DATA ACCESS LAYER FOR A PRODUCT'S COMPLETENESS PER CHANNEL

import { cache } from "react";

import { completenessService } from "@server/listing/completeness.service";

/** What each channel the shop sells on still needs from one product, as last computed (dynamic-form R4). */
export const productCompletenessDAL = {
  forProduct: cache(async (productId: string) => completenessService.forProduct(productId)),
};
