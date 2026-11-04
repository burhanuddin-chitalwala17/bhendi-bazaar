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
        back={{ href: productsBasePath, label: "Back to products" }}
        title={product.name}
        description="Product details"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/product/${product.slug}`} target="_blank" prefetch={false}>
                <Icon name="external" size="sm" />
                See it live
              </Link>
            </Button>
            {canEdit && (
              <Button asChild>
                <Link href={`${productsBasePath}/${product.id}/edit`} prefetch={false}>
                  <Icon name="edit" size="sm" />
                  Edit product
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
      />
    </div>
  );
}
