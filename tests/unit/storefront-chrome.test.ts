/**
 * Which shop's chrome a product page keeps (storefront-themes D7, Q33). Storefront links add
 * `?shop={handle}`; middleware forwards it as a request header the layout trusts, so a header a
 * browser sent must never survive, and a shop's chrome must never wrap another shop's product
 * (ux.md journey 5; A5: the buyer is never trapped in the wrong shop).
 */
import { describe, expect, it } from "vitest";

import {
  STOREFRONT_PRODUCT_HEADER,
  STOREFRONT_SHOP_HEADER,
  chromeShopFor,
  forwardStorefrontShop,
  isShopProductPath,
} from "@/lib/storefront-chrome";

const forwarded = (url: string, sent: Record<string, string> = {}) => {
  const headers = new Headers(sent);
  forwardStorefrontShop(headers, new URL(url, "https://shop.test"));
  return { shop: headers.get(STOREFRONT_SHOP_HEADER), product: headers.get(STOREFRONT_PRODUCT_HEADER) };
};

describe("forwarding ?shop= (Q33)", () => {
  it("forwards the shop and the product's slug on a product path", () => {
    expect(forwarded("/product/zari-saree?shop=zaveri")).toEqual({ shop: "zaveri", product: "zari-saree" });
  });

  it("drops a header the browser sent, with or without ?shop=", () => {
    const spoof = { [STOREFRONT_SHOP_HEADER]: "zaveri", [STOREFRONT_PRODUCT_HEADER]: "zari-saree" };
    expect(forwarded("/product/zari-saree", spoof)).toEqual({ shop: null, product: null });
    expect(forwarded("/cart?shop=zaveri", spoof)).toEqual({ shop: null, product: null });
  });

  it("forwards nothing off a product path or for a value that is not a handle", () => {
    expect(forwarded("/cart?shop=zaveri").shop).toBeNull();
    expect(forwarded("/product/zari-saree?shop=Zaveri%20%26%20Sons").shop).toBeNull();
    expect(forwarded("/product/zari-saree?shop=").shop).toBeNull();
  });

  it("forwards nothing, and does not throw, for a malformed or non-ASCII slug", () => {
    expect(forwarded("/product/%E0?shop=zaveri")).toEqual({ shop: null, product: null });
    expect(forwarded("/product/%E2%9C%93?shop=zaveri")).toEqual({ shop: null, product: null });
  });
});

describe("whose chrome a product page draws (D7)", () => {
  const shop = { id: "org-zaveri", handle: "zaveri" };

  it("the shop's, for its own product", () => {
    expect(chromeShopFor(shop, "org-zaveri")).toBe(shop);
  });

  it("the marketplace's, for another shop's product or one not on sale", () => {
    expect(chromeShopFor(shop, "org-noor")).toBeNull();
    expect(chromeShopFor(shop, null)).toBeNull();
    expect(chromeShopFor(null, "org-zaveri")).toBeNull();
  });

  it("holds only while the URL is still that shop's product", () => {
    expect(isShopProductPath("/product/zari-saree", "zaveri", "zaveri")).toBe(true);
    expect(isShopProductPath("/product/zari-saree", null, "zaveri")).toBe(false);
    expect(isShopProductPath("/product/zari-saree", "noor", "zaveri")).toBe(false);
    expect(isShopProductPath("/", "zaveri", "zaveri")).toBe(false);
    expect(isShopProductPath("/cart", "zaveri", "zaveri")).toBe(false);
  });
});
