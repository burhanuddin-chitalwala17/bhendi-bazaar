// components/admin/products/productView/index.tsx

"use client";

import { Edit, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/shared/forms/product";
import type { ProductDetails } from "./types";
import { useRouter } from "next/navigation";
import { useProductsBasePath } from "@/admin/products/useProductsBasePath";
import type { OrgSummary } from "@/domain/org";

import { PageHeader } from "@/components/shared/page-shell";
interface ProductViewProps {
  product: ProductDetails;
  /** False on the platform's support view — editing happens in the owning org's portal. */
  canEdit?: boolean;
  category: { id: string; name: string };
  org: OrgSummary;
}

export function ProductsView({ product, category, org, canEdit = true }: ProductViewProps) {
  const router = useRouter();
  const productsBasePath = useProductsBasePath();
  const onCancel = () => {
    router.push(productsBasePath);
  };
  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: productsBasePath, label: "Back to products" }}
        title={product.name}
        description="Product Details"
        actions={
          <>
            <Link href={`/product/${product.slug}`} target="_blank" prefetch={false}>
              <Button variant="outline" className="gap-2">
                <ExternalLink className="w-4 h-4" />
                View Live
              </Button>
            </Link>
            {canEdit && (
              <Link href={`${productsBasePath}/${product.id}/edit`} prefetch={false}>
                <Button className="gap-2">
                  <Edit className="w-4 h-4" />
                  Edit Product
                </Button>
              </Link>
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