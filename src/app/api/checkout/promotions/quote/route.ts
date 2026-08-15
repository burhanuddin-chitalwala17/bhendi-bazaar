/**
 * POST /api/checkout/promotions/quote — what offers do to this basket, and why.
 *
 * Separate from `/api/checkout/allocate`, which answers a different question (which
 * parcels a basket becomes). Kept apart so each keeps one job.
 *
 * The response carries per-line amounts so the browser can badge covered items
 * without re-deriving a single eligibility rule — every rule stays server-side, which
 * is the same reason a discount amount is never accepted inbound (Invariant 1).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { productsRepository } from "@server/catalog/product.repository";
import { promotionService } from "@server/promotions/promotion.service";
import { catalogueUnitPrice } from "@server/checkout/pricing";
import { quantitySchema, couponCodeSchema } from "@/lib/validation/schemas/common.schemas";
import { toErrorResponse } from "@/lib/api-error-response";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

const quoteSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: quantitySchema,
        size: z.string().trim().min(1).max(50).optional(),
        color: z.string().trim().min(1).max(50).optional(),
      })
    )
    .min(1)
    .max(100),
  code: couponCodeSchema.optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = quoteSchema.parse(await request.json());
    const productIds = [...new Set(body.items.map((item) => item.productId))];

    // Prices come from the catalogue, never from the request — the browser
    // contributes product ids, quantities and at most a code.
    const products = await productsRepository.listForPricing(productIds);
    const byId = new Map(products.map((product) => [product.id, product]));

    const lines = body.items.flatMap((item) => {
      const product = byId.get(item.productId);
      if (!product) return [];
      return [
        {
          key: `${item.productId}::${item.size ?? ""}::${item.color ?? ""}`,
          productId: product.id,
          orgId: product.orgId,
          categoryId: product.categoryId,
          unitPrice: catalogueUnitPrice(product),
          quantity: item.quantity,
        },
      ];
    });

    if (lines.length === 0) {
      return NextResponse.json({ error: "Nothing in this basket is still available" }, { status: 409 });
    }

    // Signed in or not — a per-buyer limit is enforced only where there is a buyer
    // to count, so the preview has to know which case this is.
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

    const quote = await promotionService.quote(lines, { code: body.code, userId });

    return NextResponse.json({
      lineDiscounts: Object.fromEntries(
        quote.lines.map((line) => [line.key, line.buyerDiscountPaise])
      ),
      applied: quote.attributions.map((attribution) => ({
        label: attribution.labelSnapshot,
        code: attribution.codeSnapshot,
        amountPaise: attribution.buyerDiscountPaise,
      })),
      // Which lines the code reached, so the summary can say "covers 2 of 3 items"
      // from data rather than from a rule the browser would have to know.
      couponCoveredKeys: quote.couponCoveredKeys,
      totalDiscountPaise: quote.totalDiscountPaise,
      rejection: quote.rejection,
    });
  } catch (error) {
    return toErrorResponse(error, "Could not price this basket");
  }
}
