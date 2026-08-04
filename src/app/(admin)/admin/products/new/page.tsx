/**
 * Admin New Product Page
 * Create a new product
 */

import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import { ProductAddContainer } from "@/admin/products/productAdd";
import { sellersDAL } from "@/data-access-layer/admin/sellers.dal";
import type { SellerWithStats } from "@/domain/seller";
import type { AdminCategory } from "@/domain/admin";
export default async function NewProductPage() {
  const categories = (await adminCategoriesDAL.getCategories()).categories.map((c: AdminCategory) => ({
    id: c.id,
    name: c.name,
  }));
  const sellers = (await sellersDAL.getSellers()).map((s: SellerWithStats) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    defaultPincode: s.defaultPincode,
    defaultCity: s.defaultCity,
    defaultState: s.defaultState,
    defaultAddress: s.defaultAddress ?? "",
  }));
  return (
    <div className="max-w-5xl mx-auto">
      <ProductAddContainer categories={categories} sellers={sellers} />
    </div>
  );
}

