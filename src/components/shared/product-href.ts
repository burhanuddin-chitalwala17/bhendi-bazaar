import { ROUTES } from "@server/shared/routes";

/**
 * A product's link from where the buyer is. Inside a themed shop it carries `?shop=`, so the next page
 * keeps that shop's chrome (storefront-themes Q33); elsewhere it is the canonical `/product/{slug}`.
 */
export const productHref = (slug: string, shopHandle?: string | null) =>
  shopHandle ? `${ROUTES.product(slug)}?shop=${encodeURIComponent(shopHandle)}` : ROUTES.product(slug);
