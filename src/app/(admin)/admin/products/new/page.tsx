/**
 * Admin New Product Page
 * Create a new product
 */

import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import { ProductAddContainer } from "@/admin/products/productAdd";
import { orgsDAL } from "@/data-access-layer/admin/orgs.dal";
import type { OrgWithStats } from "@/domain/org";
import type { AdminCategory } from "@/domain/admin";
export default async function NewProductPage() {
  const categories = (await adminCategoriesDAL.getCategories()).categories.map((c: AdminCategory) => ({
    id: c.id,
    name: c.name,
  }));
  const orgs = (await orgsDAL.getOrgs()).map((s: OrgWithStats) => ({
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
      <ProductAddContainer categories={categories} orgs={orgs} />
    </div>
  );
}

