import { productValueRepository, type ProductAnswers } from "./product-value.repository";

/**
 * A product's answers for another domain's read (listing-model/dynamic-form Q16): listing's public face of
 * the value rows, so channels never reach the repository itself.
 */
export const productAnswersService = {
  async answersFor(productIds: readonly string[]): Promise<Map<string, ProductAnswers>> {
    return await productValueRepository.answersFor(productIds);
  },
};
