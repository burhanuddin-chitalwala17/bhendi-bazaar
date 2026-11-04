import { PageHeader } from "@/components/shared/page-shell";
import { Icon } from "@/components/ui/icon";
import { CheckoutContainer } from "@/components/checkout";
import { productsDAL } from "@/data-access-layer/products.dal";
import { CartItem } from "@/domain/cart";
import { uuidv4 } from "zod";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { NotFoundError } from "@server/shared/domain-error";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ buyNow?: string }>;
}) {
  const params = await searchParams;
  const { buyNow } = params;
  let buyNowProductCartItem: CartItem | undefined;
  if (buyNow) {
    const buyNowProduct = await productsDAL.getProductBySlug(buyNow).catch((error: unknown) => {
      if (error instanceof NotFoundError) return null;
      throw error;
    });
    // Streamed under loading.tsx, so a 404 status is not available here; the page says it plainly.
    if (!buyNowProduct) {
      return (
        <EmptyState
          title="That piece is no longer available"
          description="It may have sold out or been taken down. Your bag is unchanged."
          action={{ label: "Back to the shop", href: "/shop" }}
        />
      );
    }
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
      shippingFromPincode: buyNowProduct.shippingFromPincode,
      org: buyNowProduct.org,
    };
  }

  return (
    <div className="space-y-6">
      {/* StoreCheckout's bar: the way back to the bag, the page's name, and that payment is secure. */}
      <PageHeader
        title="Checkout"
        back={{ href: "/cart", label: "Your bag" }}
        actions={
          <span className="inline-flex items-center gap-1.5 text-caption font-medium text-success">
            <Icon name="secure" size="sm" />
            Secure
          </span>
        }
      />

      {/* Keyed: a different buy-now item is a different checkout, with its own snapshot. */}
      <CheckoutContainer key={buyNow ?? "cart"} buyNowProduct={buyNowProductCartItem} />
    </div>
  );
}
