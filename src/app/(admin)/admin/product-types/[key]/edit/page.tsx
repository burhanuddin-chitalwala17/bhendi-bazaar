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
import { PRODUCT_TYPE_PAGE_COPY } from "@/components/product-type/product-type-copy";
import { ROUTES } from "@server/shared/routes";

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
        description={PRODUCT_TYPE_PAGE_COPY.editDescription(usage?.categories ?? 0, usage?.products ?? 0)}
        back={{ href: ROUTES.admin.productTypes, label: PRODUCT_TYPE_PAGE_COPY.back }}
      />
      <ProductTypeForm type={type} />
    </PageShell>
  );
}
