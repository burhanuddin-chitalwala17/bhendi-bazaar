import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import { ProductsContainer } from "@/components/product/console/productsList";
import { resolvePageNumber, resolvePageSize } from "@server/shared/pagination";
import type { ProductShelf } from "@server/catalog/product.visibility";

const SHELVES: ProductShelf[] = ["available", "archived", "all"];
const shelfFrom = (value: string | undefined): ProductShelf =>
  SHELVES.find((shelf) => shelf === value) ?? "available";

interface Props {
  orgId: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function AdminOrgProducts({ orgId, searchParams }: Props) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const filters = {
    orgId,
    page: resolvePageNumber(one("page")),
    limit: resolvePageSize(one("limit")),
    search: one("search"),
    categoryId: one("category"),
    sortBy: one("sort") as "name" | "createdAt" | "price" | "stock" | undefined,
    sortOrder: one("order") as "asc" | "desc" | undefined,
    shelf: shelfFrom(one("shelf")),
  };

  const [productsData, stats, categoryList] = await Promise.all([
    adminProductsDAL.getProducts(filters),
    adminProductsDAL.getStats(orgId),
    adminCategoriesDAL.getCategories(),
  ]);

  return (
    <ProductsContainer
      initialData={productsData}
      initialStats={stats}
      initialFilters={filters}
      categories={categoryList.categories}
      readOnly
    />
  );
}
