// hooks/product/useProductActions.ts

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCartStore } from "@/store/cartStore";
import type { Product } from "@/domain/product";

export function useProductActions(product: Product) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const items = useCartStore((state) => state.items);

  const [isAddingToCart, startAddToCart] = useTransition();
  const [isBuyingNow, startBuyNow] = useTransition();

  const isOutOfStock = product.stock === 0;
  const currentCartQty =
    items.find((item) => item.productId === product.id)?.quantity || 0;
  const remainingStock = product.stock - currentCartQty;

  const handleAddToCart = () => {
    if (isOutOfStock) {
      toast.warning("This item is out of stock");
      return;
    }

    if (currentCartQty + 1 > product.stock) {
      toast.warning(
        `Cannot add more. Maximum ${product.stock} available (${currentCartQty} already in cart)`
      );
      return;
    }
    // after stock validation done
    startAddToCart(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            addItem({
              productId: product.id,
              productName: product.name,
              productSlug: product.slug,
              thumbnail: product.thumbnail,
              price: product.price,
              salePrice: product.salePrice,
              quantity: 1,
              weight: product.weight ?? 0.5,
              shippingFromPincode: product.shippingFromPincode,
              org: product.org,
            });
            toast.success("Added to cart");
            resolve(undefined);
          }, 300);
        })
    );
    // console.log("CartItems: ", JSON.stringify(items, null, 2));
  };

  const handleBuyNow = () => {
    if (isOutOfStock) {
      toast.error("This item is out of stock");
      return;
    }

    if (currentCartQty >= product.stock) {
      toast.error(
        `You already have ${currentCartQty} in your cart (maximum available)`
      );
      return;
    }

    // Navigate to checkout with product ID in URL
    startBuyNow(() => {
      router.push(`/checkout?buyNow=${product.slug}`);
    });
  };

  return {
    handleAddToCart,
    handleBuyNow,
    isAddingToCart,
    isBuyingNow,
    isOutOfStock,
    currentCartQty,
    remainingStock,
  };
}