// components/admin/products/productAdd/index.tsx

"use client";

import type { UploadEndpoints } from "@/lib/image/upload-endpoints";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { ProductForm } from "@/components/shared/forms/product";
import { useProducts } from "../useProducts";
import { useProductsBasePath } from "@/components/product/console/useProductsBasePath";
import type { OrgSummary } from "@/domain/org";
import type { LocationOption } from "@/components/shared/forms/product/ProductOrgShippingFields";
import type {
  ProductCopyOption,
  ProductCopySource,
} from "@server/catalog/admin.product.types";
import { CopyFromPicker } from "./CopyFromPicker";

import { PageHeader } from "@/components/shared/page-shell";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
interface ProductAddContainerProps {
  categories: {
    id: string;
    name: string;
    parentId?: string | null;
    shotList?: unknown;
    productType?: unknown;
  }[];
  /** The question sets and the answers for the category rendered with — read by the page. */
  productTypes?: ProductTypeRecord[];
  listingValues?: Record<string, Array<{ key: string; label: string; orgId: string | null }>>;
  families?: Array<{ id: string; name: string }>;
  orgs: OrgSummary[];
  locations: LocationOption[];
  /** The product this one is being copied from, already scoped to the org. */
  copySource?: ProductCopySource | null;
  /** The org's products offered in the "Copy from" picker. */
  copyOptions?: ProductCopyOption[];
  /** The presign route for image uploads; the org portal passes its member-guarded one. */
  uploadEndpoints?: UploadEndpoints;
}

export function ProductAddContainer({
  categories,
  productTypes,
  listingValues,
  families,
  orgs,
  locations,
  copySource,
  copyOptions = [],
  uploadEndpoints,
}: ProductAddContainerProps) {
  const router = useRouter();
  const productsBasePath = useProductsBasePath();

  // The stepped form shows its own success screen (product-form Q16), so nothing navigates away.
  const { createProduct, isLoading } = useProducts({ stayAfterCreate: true });

  const handleCancel = () => {
    router.push(productsBasePath);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: productsBasePath, label: "Back to products" }}
        title="Add product"
      />

      <ProductForm
        key={copySource?.id ?? "blank"}
        copySource={copySource}
        categories={categories}
        productTypes={productTypes}
        listingValues={listingValues}
        families={families}
        orgs={orgs}
        locations={locations}
        onSubmit={createProduct}
        onCancel={handleCancel}
        isSubmitting={isLoading}
        readOnly={false}
        uploadEndpoints={uploadEndpoints}
        copyFrom={
          copyOptions.length > 0 && (
            <div className="space-y-2 rounded-card border border-border bg-card p-3">
              <p className="text-sm font-medium text-foreground">Start from a product you already sell</p>
              <CopyFromPicker
                options={copyOptions}
                selectedId={copySource?.id}
                newProductPath={`${productsBasePath}/new`}
              />
              {copySource && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Copy className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    Copied from <strong>{copySource.name}</strong> — description, category, details
                    and flags. Add photos, a name, price and stock.
                  </span>
                </p>
              )}
            </div>
          )
        }
      />
    </div>
  );
}
