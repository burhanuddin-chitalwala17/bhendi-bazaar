import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import type { SizeStep } from "@server/cart/checkout-link.types";
import { ROUTES } from "@server/shared/routes";
import { CHECKOUT_LINK_COPY } from "./checkout-link-copy";

/** "Pick your size" before checkout, for a link item sold in sizes (checkout-links D6, ux.md journey 6). */
export function CheckoutLinkSizeStep({ shop, token, picked, step }: { shop: string; token: string; picked: string[]; step: SizeStep }) {
  return (
    <div className="space-y-4">
      <PageHeader title={CHECKOUT_LINK_COPY.pickSize} />
      <ul className="grid gap-2 md:grid-cols-2">
        {step.options.map((option) => (
          <li key={option.productId}>
            <Button asChild variant="outline" className="h-auto min-h-12 w-full justify-start gap-3 whitespace-normal py-2">
              <Link href={ROUTES.checkoutLinkWithSizes(shop, token, [...picked, option.productId])} prefetch={false}>
                <Image src={option.thumbnail} alt="" width={40} height={40} sizes="40px" className="size-10 rounded-field object-cover" />
                <span className="text-left">{option.name}</span>
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
