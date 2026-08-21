// src/app/api/search/suggestions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { productService } from "@server/catalog/product.service";
import { categoryService } from "@server/catalog/category.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json({ products: [], categories: [] });
    }

    const q = query.toLowerCase();

    // Get matching products (limit to 5 for suggestions)
    const products = await productService.searchProducts(query, 5);

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
      products: products.slice(0, 5),
      categories: matchingCategories,
    });
  } catch (error) {
    console.error("Failed to fetch suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}