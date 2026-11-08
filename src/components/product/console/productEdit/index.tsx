// components/admin/products/productAdd/index.tsx

"use client";

import type { BrandDto } from "@server/catalog/brand.types";
import type { UploadEndpoints } from "@/lib/image/upload-endpoints";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ProductForm } from "@/components/shared/forms/product";
import { useProducts } from "../useProducts";
import type { ProductDetails } from "../types";
import { useProductsBasePath } from "@/components/product/console/useProductsBasePath";
import type { OrgSummary } from "@/domain/org";
import type { LocationOption } from "@/components/shared/forms/product/ProductOrgShippingFields";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

import { PageHeader } from "@/components/shared/page-shell";
import type { PortalNavKey } from "@/components/layout/portal-nav";
import { PRODUCT_EDIT_HEADER_COPY } from "@/components/product/console/console-copy";
interface ProductEditContainerProps {
  /** The shop portal's "?" key; the admin console passes none. */
  help?: PortalNavKey;
  product: ProductDetails;
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
  brands?: BrandDto[];
  /** The shop's own country of origin, for a product whose brand names none (A4). */
  shopCountry?: string | null;
  orgs: OrgSummary[];
  locations: LocationOption[];
  /** The presign route for image uploads; the org portal passes its member-guarded one. */
  uploadEndpoints?: UploadEndpoints;
  /** The shop sells on another channel, so the Details card carries what it would ask (R5, R7). */
  sellsElsewhere?: boolean;
  /** The Bhendi Bazaar team editing for this shop (product-form R10). */
  team?: { shopName: string };
  /** Where "Back" goes; the team returns to the product, the shop to its list. */
  backHref?: string;
}

export function ProductEditContainer({
  product,
  categories,
  productTypes,
  listingValues,
  families,
  brands,
  shopCountry = null,
  orgs,
  locations,
  uploadEndpoints,
  sellsElsewhere = false,
  team,
  backHref,
  help,
}: ProductEditContainerProps) {
  const router = useRouter();
  const productsBasePath = useProductsBasePath();
  const { updateProduct, isLoading, error, successMessage } = useProducts({ stayAfterUpdate: true });

  const back = backHref ?? productsBasePath;
  const handleCancel = () => {
    router.push(back);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        help={help}
        back={{ href: back, label: team ? PRODUCT_EDIT_HEADER_COPY.backTeam : PRODUCT_EDIT_HEADER_COPY.back }}
        title={`Edit Product: ${product.name}`}
      />

      {/* Messages */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-start gap-3">
          <Icon name="error" size="md" className="mt-0.5" />
          <p>{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg flex items-start gap-3">
          <Icon name="success" size="md" className="mt-0.5" />
          <p>{successMessage}</p>
        </div>
      )}

      <ProductForm
        product={product}
        categories={categories}
        productTypes={productTypes}
        listingValues={listingValues}
        families={families}
        brands={brands}
          shopCountry={shopCountry}
        orgs={orgs}
        locations={locations}
        onSubmit={updateProduct}
        onCancel={handleCancel}
        isSubmitting={isLoading}
        readOnly={false}
        uploadEndpoints={uploadEndpoints}
        sellsElsewhere={sellsElsewhere}
        team={team}
      />
    </div>
  );
}
