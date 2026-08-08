import { notFound } from "next/navigation";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import { ProductAddContainer } from "@/admin/products/productAdd";
import { orgsDAL } from "@/data-access-layer/admin/orgs.dal";
import type { AdminCategory } from "@/domain/admin";

export default async function OrgNewProductPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const categories = (await adminCategoriesDAL.getCategories()).categories.map(
    (c: AdminCategory) => ({ id: c.id, name: c.name })
  );

  // One org, not a list: in this portal there is nothing to choose between, and offering
  // the choice would be offering a product owned by somebody else.
  const org = (await orgsDAL.getOrgs()).find((o) => o.id === orgId);
  if (!org) notFound();

  const orgs = [
    {
      id: org.id,
      name: org.name,
      code: org.code,
      defaultPincode: org.defaultPincode,
      defaultCity: org.defaultCity,
      defaultState: org.defaultState,
      defaultAddress: org.defaultAddress ?? "",
    },
  ];

  return <ProductAddContainer categories={categories} orgs={orgs} />;
}
