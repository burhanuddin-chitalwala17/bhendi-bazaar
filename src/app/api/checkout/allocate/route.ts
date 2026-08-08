/**
 * POST /api/checkout/allocate — which parcels a basket becomes (stock-locations R5,
 * R10): the same pure allocation the order transaction runs, as a preview, so the
 * customer sees every parcel — each quoted from its own origin — before paying.
 *
 * The response names parcels and their contents, never how much stock sits where:
 * a per-location figure that reaches the browser has been disclosed whether or not
 * it is displayed (A9).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@server/shared/prisma";
import { allocateAcrossOrgs } from "@server/checkout/allocation";
import { billableWeightKg } from "@server/shipping/billable-weight";
import { quantitySchema } from "@/lib/validation/schemas/common.schemas";
import { PINCODE_PATTERN, PINCODE_MESSAGE } from "@server/shared/pincode";
import { toErrorResponse } from "@/lib/api-error-response";

const allocateSchema = z.object({
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
  destinationPincode: z.string().regex(PINCODE_PATTERN, PINCODE_MESSAGE),
});

export async function POST(request: NextRequest) {
  try {
    const body = allocateSchema.parse(await request.json());
    const productIds = [...new Set(body.items.map((item) => item.productId))];

    const [products, stockRows] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, weight: true, orgId: true, org: { select: { name: true, code: true } } },
      }),
      prisma.productStock.findMany({
        where: { productId: { in: productIds }, quantity: { gt: 0 }, orgAddress: { isActive: true } },
        select: {
          productId: true,
          orgAddressId: true,
          quantity: true,
          orgAddress: {
            select: {
              orgId: true,
              name: true,
              address: { select: { pincode: true, city: true, state: true } },
            },
          },
        },
      }),
    ]);

    const productsById = new Map(products.map((product) => [product.id, product]));
    const locationInfo = new Map(stockRows.map((row) => [row.orgAddressId, row.orgAddress]));
    const parcels = allocateAcrossOrgs(
      body.items,
      new Map(products.map((product) => [product.id, product.orgId])),
      stockRows,
      new Map([...locationInfo.entries()].map(([id, info]) => [id, info.address.pincode])),
      body.destinationPincode,
      new Map(products.map((product) => [product.id, product.name]))
    );

    return NextResponse.json({
      groups: parcels.map((parcel) => {
        const location = locationInfo.get(parcel.orgAddressId);
        const anyProduct = productsById.get(parcel.lines[0]?.productId ?? "");
        const totalWeight = parcel.lines.reduce(
          (sum, line) => sum + (productsById.get(line.productId)?.weight ?? 0) * line.quantity,
          0
        );
        return {
          groupId: parcel.orgAddressId,
          orgId: location?.orgId ?? "",
          orgName: anyProduct?.org.name ?? "",
          orgCode: anyProduct?.org.code ?? "",
          locationName: location?.name ?? "",
          fromPincode: location?.address.pincode ?? "",
          fromCity: location?.address.city ?? "",
          fromState: location?.address.state ?? "",
          items: parcel.lines,
          totalWeight,
          // What the rate is quoted on: the sum rounded up to whole kilograms,
          // floor 1 kg (product-weight-and-rates, decided 2026-08-10).
          billableWeightKg: billableWeightKg(totalWeight),
        };
      }),
    });
  } catch (error) {
    return toErrorResponse(error, "Could not plan your parcels");
  }
}
