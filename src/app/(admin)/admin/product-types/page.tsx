/**
 * The question sets — a server component ([ADR-0034]).
 *
 * A type decides which questions a product is asked; it is not what a buyer browses. The usage
 * counts beside each one are the point of the screen: editing a type changes what is asked of
 * every product under it, and the number is what makes that visible before it happens.
 */
import Link from "next/link";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Icon } from "@/components/ui/icon";
import { adminProductTypesDAL } from "@/data-access-layer/admin/product-types.dal";
import { ProductTypesTable } from "@/components/product-type/console/ProductTypesTable";
import { Button } from "@/components/ui/button";
import { PRODUCT_TYPE_PAGE_COPY } from "@/components/product-type/product-type-copy";
import { ROUTES } from "@server/shared/routes";

export default async function AdminProductTypesPage() {
  const types = await adminProductTypesDAL.getProductTypes(true);
  const usage = await adminProductTypesDAL.getUsage(types.map((type) => type.key));

  return (
    <PageShell width="wide">
      <PageHeader
        title={PRODUCT_TYPE_PAGE_COPY.title}
        description={PRODUCT_TYPE_PAGE_COPY.description}
        actions={
          <Button asChild>
            <Link href={ROUTES.admin.newProductType} prefetch={false}>
              <Icon name="add" />
              {PRODUCT_TYPE_PAGE_COPY.newType}
            </Link>
          </Button>
        }
      />
      <ProductTypesTable types={types} usage={usage} />
    </PageShell>
  );
}
