// components/admin/products/productAdd/index.tsx

"use client";

import type { UploadEndpoints } from "@/lib/image/upload-endpoints";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Copy } from "lucide-react";
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

  const { createProduct, isLoading, error, successMessage } = useProducts();

  const handleCancel = () => {
    router.push(productsBasePath);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: productsBasePath, label: "Back to products" }}
        title="Create New Product"
        description="Add a new product to your catalog"
        actions={
          <CopyFromPicker
            options={copyOptions}
            selectedId={copySource?.id}
            newProductPath={`${productsBasePath}/new`}
          />
        }
      />

      {copySource && (
        <div className="bg-info/10 border border-info/30 text-info px-4 py-3 rounded-lg flex items-start gap-3">
          <Copy className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            Copied from <strong>{copySource.name}</strong> — description,
            category, attributes and flags. Add a name, price, photos and stock
            for this product.
          </p>
        </div>
      )}

      {successMessage && (
        <div className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{successMessage}</p>
        </div>
      )}

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
      />

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
