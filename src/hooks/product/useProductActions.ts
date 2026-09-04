// hooks/product/useProductActions.ts

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCartStore } from "@/store/cartStore";
import type { Product } from "@/domain/product";

export function useProductActions(product: Product, selectedSize?: string) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const items = useCartStore((state) => state.items);

  const [isAddingToCart, startAddToCart] = useTransition();
  const [isBuyingNow, startBuyNow] = useTransition();

  // A product that offers sizes cannot be ordered without one: the order line is
  // the packing instruction, and checkout rejects a line whose size it never offered.
  const requiresSize = (product.options?.sizes?.length ?? 0) > 0;

  const isOutOfStock = product.stock === 0;
  // Stock is held per product, not per size, so every line of this product counts
  // against it — one size's line alone would undercount once sizes are selectable.
  const currentCartQty = items
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => sum + item.quantity, 0);
  const remainingStock = product.stock - currentCartQty;

  const handleAddToCart = () => {
    if (isOutOfStock) {
      toast.warning("This item is out of stock");
      return;
    }

    if (requiresSize && !selectedSize) {
      toast.warning("Please select a size");
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
              size: selectedSize,
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

    if (requiresSize && !selectedSize) {
      toast.warning("Please select a size");
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
      const query = new URLSearchParams({ buyNow: product.slug });
      if (selectedSize) query.set("size", selectedSize);
      router.push(`/checkout?${query.toString()}`);
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