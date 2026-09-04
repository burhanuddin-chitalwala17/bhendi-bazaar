// src/app/(main)/checkout/page.tsx

import { SectionHeader } from "@/components/shared/SectionHeader";
import { CheckoutContainer } from "@/containers/checkoutContainer";
import { productsDAL } from "@/data-access-layer/products.dal";
import { CartItem } from "@/domain/cart";
import { uuidv4 } from "zod";

export default async function CheckoutPage({
  searchParams
}: {
  searchParams: Promise<{ buyNow?: string; size?: string }>
}) {
  const params = await searchParams;
  const { buyNow, size } = params;
  let buyNowProductCartItem: CartItem | undefined;
  if (buyNow) {

    const buyNowProduct = await productsDAL.getProductBySlug(buyNow);
    // The size is a URL param, so it is untrusted: only one the catalogue actually
    // offers reaches the line. Checkout would refuse the rest anyway, later and louder.
    const chosenSize =
      size && buyNowProduct.options?.sizes?.includes(size) ? size : undefined;
    buyNowProductCartItem = {
      weight: 0.5,
      id: uuidv4().toString(),
      productId: buyNowProduct.id,
      productName: buyNowProduct.name,
      productSlug: buyNowProduct.slug,
      thumbnail: buyNowProduct.thumbnail,
      price: buyNowProduct.price,
      salePrice: buyNowProduct.salePrice,
      quantity: 1,
      size: chosenSize,
      shippingFromPincode: buyNowProduct.shippingFromPincode,
      org: buyNowProduct.org,
    };
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        overline="Checkout"
        title="Finalise your Bhendi Bazaar order"
      />

      <CheckoutContainer buyNowProduct={buyNowProductCartItem} />
    </div>
  );
}
