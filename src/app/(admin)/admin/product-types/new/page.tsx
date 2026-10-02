/**
 * Create a product type — a server component ([ADR-0034]). The form is the client leaf.
 */
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { ProductTypeForm } from "@/components/product-type/product-type-form";

export default function NewProductTypePage() {
  return (
    <PageShell width="form">
      <PageHeader
        title="New product type"
        description="The questions a product line is asked. A category points at one; the questions follow."
        back={{ href: "/admin/product-types", label: "Product types" }}
      />
      <ProductTypeForm />
    </PageShell>
  );
}
