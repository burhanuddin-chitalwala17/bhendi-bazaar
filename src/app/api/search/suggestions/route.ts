// src/app/api/search/suggestions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { productService } from "@server/catalog/product.service";
import { categoryService } from "@server/catalog/category.service";
import { loadPriceContext } from "@server/promotions/price-context";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json({ products: [], categories: [] });
    }

    const q = query.toLowerCase();

    // Get matching products (limit to 5 for suggestions)
    const [products, priceContext] = await Promise.all([
      productService.searchProducts(query, 5),
      loadPriceContext(),
    ]);

    // A list price here and an offer price one click later is the drift ADR-0018
    // exists to stop, so the dropdown prices through the same resolver.
    const suggestions = products.map((product) =>
      productService.toSuggestion(product, priceContext)
    );

    // Matching categories, from the storefront's own list — the admin listing this
    // used to call carried a per-category product count and a total-count query
    // that the dropdown never rendered.
    const matchingCategories = (await categoryService.getCategories())
      .filter(
        (cat) =>
          cat.name.toLowerCase().includes(q) ||
          cat.slug.toLowerCase().includes(q)
      )
      .map((cat) => ({ name: cat.name, slug: cat.slug }))
      .slice(0, 3);

    return NextResponse.json({
      products: suggestions,
      categories: matchingCategories,
    });
  } catch (error) {
    return toErrorResponse(error, "Could not fetch suggestions");
  }
}
