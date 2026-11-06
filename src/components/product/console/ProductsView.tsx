"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ProductForm } from "@/components/shared/forms/product";
import type { ProductDetails } from "./types";
import { useRouter } from "next/navigation";
import { useProductsBasePath } from "@/components/product/console/useProductsBasePath";
import type { OrgSummary } from "@/domain/org";

import { PageHeader } from "@/components/shared/page-shell";
import type { PortalNavKey } from "@/components/layout/portal-nav";
import { ROUTES } from "@server/shared/routes";
import { PRODUCT_CONSOLE_COPY } from "./console-copy";
import type { LocationOption } from "@/components/shared/forms/product/ProductOrgShippingFields";

/**
 * The locations a read-only view shows: the ones holding this product's stock. Without them the form
 * read as "Add your shop address" and "Total: 0" on a product with stock (stock-locations R9).
 */
export function heldAt(product: Pick<ProductDetails, "stockLocations">): LocationOption[] {
  return product.stockLocations.map((row) => ({ id: row.orgAddressId, name: row.locationName, city: row.city ?? "", pincode: row.pincode ?? "", isActive: row.isActive ?? true }));
}
interface ProductViewProps {
  /** The shop portal's "?" key; the admin console passes none. */
  help?: PortalNavKey;
  product: ProductDetails;
  /** False on the platform's support view — editing happens in the owning org's portal. */
  canEdit?: boolean;
  category: { id: string; name: string };
  org: OrgSummary;
}

export function ProductsView({
  product,
  category,
  org,
  canEdit = true,
  help,
}: ProductViewProps) {
  const router = useRouter();
  const productsBasePath = useProductsBasePath();
  const onCancel = () => {
    router.push(productsBasePath);
  };
  return (
    <div className="space-y-8">
      <PageHeader
        help={help}
        back={{ href: productsBasePath, label: PRODUCT_CONSOLE_COPY.view.back }}
        title={product.name}
        description={PRODUCT_CONSOLE_COPY.view.description}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.product(product.slug)} target="_blank" prefetch={false}>
                <Icon name="external" size="sm" />
                {PRODUCT_CONSOLE_COPY.view.seeLive}
              </Link>
            </Button>
            {canEdit && (
              <Button asChild>
                <Link href={`${productsBasePath}/${product.id}/edit`} prefetch={false}>
                  <Icon name="edit" size="sm" />
                  {PRODUCT_CONSOLE_COPY.view.edit}
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* Product Form in Read-Only Mode */}
      <ProductForm
        product={product}
        categories={[category]}
        orgs={[org]}
        onSubmit={async () => {
          return product;
        }}
        onCancel={onCancel}
        readOnly={true}
        locations={heldAt(product)}
      />
    </div>
  );
}
