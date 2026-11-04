// components/admin/products/productAdd/index.tsx

"use client";

import type { UploadEndpoints } from "@/lib/image/upload-endpoints";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { toast } from "sonner";
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
import type { PortalNavKey } from "@/components/layout/portal-nav";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
interface ProductAddContainerProps {
  /** The shop portal's "?" key; the admin console passes none. */
  help?: PortalNavKey;
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
  /** The shop has turned on at least one channel besides its store, so readiness has something to say. */
  sellsElsewhere?: boolean;
  /** Opened from Home's setup list: a saved product goes back there (own-store onboarding D8). */
  returnTo?: string | null;
  /** The Bhendi Bazaar team adding for this shop (product-form R10). */
  team?: { shopName: string };
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
  sellsElsewhere = false,
  returnTo = null,
  team,
  help,
}: ProductAddContainerProps) {
  const router = useRouter();
  const productsBasePath = useProductsBasePath();

  // The stepped form shows its own success screen (product-form Q16), so nothing navigates away.
  const { createProduct, isLoading } = useProducts({ stayAfterCreate: true });

  const submit = async (data: Parameters<typeof createProduct>[0]) => {
    const product = await createProduct(data);
    if (product && team) {
      // The team's next step is the product it made, not the shop's success screen (ux.md, Admin).
      toast.success(`Saved. ${team.shopName} will see what changed.`);
      router.push(`/admin/products/${product.id}`);
    } else if (product && returnTo) router.push(returnTo);
    return product;
  };

  const handleCancel = () => {
    router.push(productsBasePath);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        help={help}
        back={{ href: productsBasePath, label: "Back to products" }}
        title={team ? "Add product for this shop" : "Add product"}
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
        onSubmit={submit}
        onCancel={handleCancel}
        isSubmitting={isLoading}
        readOnly={false}
        uploadEndpoints={uploadEndpoints}
        sellsElsewhere={sellsElsewhere}
        team={team}
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
                  <Icon name="copy" className="mt-0.5" />
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
