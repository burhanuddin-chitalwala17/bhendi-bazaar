/**
 * Edit a product type — a server component ([ADR-0034]).
 *
 * Editing changes what is asked next time and rewrites nothing already stored: answers live on
 * the product, so removing a fact stops it being asked and leaves every answer where it is
 * (product-types R3). The usage count is shown because that is what makes the scope visible.
 */
import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { ProductTypeForm } from "@/components/product-type/product-type-form";
import { adminProductTypesDAL } from "@/data-access-layer/admin/product-types.dal";

export default async function EditProductTypePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const type = await adminProductTypesDAL.getProductType(key);
  if (!type) notFound();

  const usage = (await adminProductTypesDAL.getUsage([key]))[key];

  return (
    <PageShell width="form">
      <PageHeader
        title={type.label}
        description={`Used by ${usage?.categories ?? 0} categories and ${usage?.products ?? 0} products. Changing what it asks never rewrites an answer already given.`}
        back={{ href: "/admin/product-types", label: "Product types" }}
      />
      <ProductTypeForm type={type} />
    </PageShell>
  );
}
