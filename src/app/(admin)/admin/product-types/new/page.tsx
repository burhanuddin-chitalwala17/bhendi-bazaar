/**
 * Create a product type — a server component ([ADR-0034]). The form is the client leaf.
 */
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { ProductTypeForm } from "@/components/product-type/product-type-form";
import { PRODUCT_TYPE_PAGE_COPY } from "@/components/product-type/product-type-copy";
import { ROUTES } from "@server/shared/routes";

export default function NewProductTypePage() {
  return (
    <PageShell width="form">
      <PageHeader
        title={PRODUCT_TYPE_PAGE_COPY.newTitle}
        description={PRODUCT_TYPE_PAGE_COPY.newDescription}
        back={{ href: ROUTES.admin.productTypes, label: PRODUCT_TYPE_PAGE_COPY.back }}
      />
      <ProductTypeForm />
    </PageShell>
  );
}
