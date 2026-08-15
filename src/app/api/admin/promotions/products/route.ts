/** GET /api/admin/promotions/products?q= — the offer form's product search. */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { productsRepository } from "@server/catalog/product.repository";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const search = new URL(request.url).searchParams.get("q") ?? undefined;
    return NextResponse.json(await productsRepository.listForPicker({ search }));
  } catch (error) {
    return toErrorResponse(error, "Could not search products");
  }
}
