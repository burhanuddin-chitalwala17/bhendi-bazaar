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

export default async function AdminProductTypesPage() {
  const types = await adminProductTypesDAL.getProductTypes(true);
  const usage = await adminProductTypesDAL.getUsage(types.map((type) => type.key));

  return (
    <PageShell width="wide">
      <PageHeader
        title="Product types"
        description="What a product is asked about. A category points at one; the questions follow."
        actions={
          <Button asChild>
            <Link href="/admin/product-types/new" prefetch={false}>
              <Icon name="add" />
              New type
            </Link>
          </Button>
        }
      />
      <ProductTypesTable types={types} usage={usage} />
    </PageShell>
  );
}
