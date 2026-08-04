// src/app/api/search/suggestions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { productService } from "@server/catalog/product.service";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";

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

    // Get matching categories
    const matchingCategories = (await adminCategoriesDAL.getCategories()).categories
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