/**
 * How a product page learns which shop's chrome to keep (storefront-themes D7, Q33). Storefront
 * links add `?shop={handle}`; middleware forwards it, with the product's slug, as request
 * headers the `(main)` layout reads. Always cleared first: a header the browser sent is never
 * trusted, and the layout still checks the product is that shop's.
 */
export const STOREFRONT_SHOP_HEADER = "x-storefront-shop";
export const STOREFRONT_PRODUCT_HEADER = "x-storefront-product";

/** A handle's shape (lowercase slug); anything else is not a shop and is dropped. */
const HANDLE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
const PRODUCT_PATH = /^\/product\/([^/]+)\/?$/;

export function forwardStorefrontShop(headers: Headers, url: URL): void {
  headers.delete(STOREFRONT_SHOP_HEADER);
  headers.delete(STOREFRONT_PRODUCT_HEADER);
  const product = PRODUCT_PATH.exec(url.pathname)?.[1];
  const shop = url.searchParams.get("shop");
  if (!product || !shop || !HANDLE.test(shop)) return;
  const slug = decodeSlug(product);
  if (!slug) return;
  headers.set(STOREFRONT_SHOP_HEADER, shop);
  headers.set(STOREFRONT_PRODUCT_HEADER, slug);
}

/** A slug is ASCII; a malformed escape or a wider character is no shop's product, and must not 500 middleware. */
function decodeSlug(raw: string): string | null {
  try {
    const slug = decodeURIComponent(raw);
    return /^[\x20-\x7e]+$/.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

/** The shop whose chrome a product page draws: only a themed shop, and only for its own product. */
export function chromeShopFor<S extends { id: string }>(shop: S | null, productOrgId: string | null): S | null {
  return shop && productOrgId && shop.id === productOrgId ? shop : null;
}

/** Whether a URL is still a product reached from this shop: the condition the shop's chrome holds on. */
export function isShopProductPath(pathname: string, shop: string | null, handle: string): boolean {
  return PRODUCT_PATH.test(pathname) && shop === handle;
}
