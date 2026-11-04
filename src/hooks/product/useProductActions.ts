import { useState, useTransition } from "react";
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
  // The bag's drop plays once per add that landed; cleared first so a second add replays it.
  const [justAdded, setJustAdded] = useState(false);

  const isOutOfStock = product.stock === 0;
  /**
   * Display state only. The cart service and the order transaction refuse it too, so a
   * client that skips this check gains nothing (bidding spec R31).
   */
  const isUpForBidding = Boolean(product.biddingSlug);
  const currentCartQty =
    items.find((item) => item.productId === product.id)?.quantity || 0;
  const remainingStock = product.stock - currentCartQty;

  const handleAddToCart = () => {
    if (isUpForBidding) {
      toast.warning("This item is up for bidding and cannot be bought directly");
      return;
    }

    if (isOutOfStock) {
      toast.warning("This item is out of stock");
      return;
    }

    if (currentCartQty + 1 > product.stock) {
      toast.warning(
        `Only ${product.stock} available, and ${currentCartQty} already in your bag`
      );
      return;
    }
    setJustAdded(false);
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
            toast.success("Added to your bag");
            setJustAdded(true);
            resolve(undefined);
          }, 300);
        })
    );
  };

  const handleBuyNow = () => {
    if (isUpForBidding) {
      toast.error("This item is up for bidding and cannot be bought directly");
      return;
    }

    if (isOutOfStock) {
      toast.error("This item is out of stock");
      return;
    }

    if (currentCartQty >= product.stock) {
      toast.error(
        `You already have all ${currentCartQty} available in your bag`
      );
      return;
    }

    startBuyNow(() => {
      router.push(`/checkout?buyNow=${product.slug}`);
    });
  };

  return {
    handleAddToCart,
    handleBuyNow,
    isAddingToCart,
    isBuyingNow,
    justAdded,
    isOutOfStock,
    currentCartQty,
    remainingStock,
  };
}