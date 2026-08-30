// components/admin/products/productAdd/index.tsx

"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle } from "lucide-react";
import { ProductForm } from "@/components/shared/forms/product";
import { useProducts } from "../useProducts";
import { useProductsBasePath } from "@/admin/products/useProductsBasePath";
import type { OrgSummary } from "@/domain/org";
import type { LocationOption } from "@/components/shared/forms/product/ProductOrgShippingFields";


import { PageHeader } from "@/components/shared/page-shell";
interface ProductAddContainerProps {
    categories: { id: string; name: string }[];
    orgs: OrgSummary[];
    locations: LocationOption[];
    /** Where image uploads go; the org portal passes its member-guarded route. */
    uploadEndpoint?: string;
}

export function ProductAddContainer({ categories, orgs, locations, uploadEndpoint }: ProductAddContainerProps) {
    const router = useRouter();
    const productsBasePath = useProductsBasePath();

    const { createProduct, isLoading, error, successMessage } = useProducts();

    const handleCancel = () => {
        router.push(productsBasePath);
    };

    return (
        <div className="space-y-8">
            <PageHeader
                back={{ href: productsBasePath, label: "Back to products" }}
                title="Create New Product"
                description="Add a new product to your catalog"
            />

            {/* Messages */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>{error}</p>
                </div>
            )}
            {successMessage && (
                <div className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>{successMessage}</p>
                </div>
            )}

            <ProductForm
                categories={categories}
                orgs={orgs}
                locations={locations}
                onSubmit={createProduct}
                onCancel={handleCancel}
                isSubmitting={isLoading}
                readOnly={false}
                uploadEndpoint={uploadEndpoint}
            />

        </div>
    );
}