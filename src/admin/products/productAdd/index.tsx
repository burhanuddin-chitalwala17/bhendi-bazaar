// components/admin/products/productAdd/index.tsx

"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { ProductForm } from "@/components/shared/forms/product";
import { useProducts } from "../useProducts";
import { useProductsBasePath } from "@/admin/products/useProductsBasePath";
import type { OrgSummary } from "@/domain/org";
import type { LocationOption } from "@/components/shared/forms/product/ProductOrgShippingFields";


interface ProductAddContainerProps {
    categories: { id: string; name: string }[];
    orgs: OrgSummary[];
    locations: LocationOption[];
}

export function ProductAddContainer({ categories, orgs, locations }: ProductAddContainerProps) {
    const router = useRouter();
    const productsBasePath = useProductsBasePath();

    const { createProduct, isLoading, error, successMessage } = useProducts();

    const handleCancel = () => {
        router.push(productsBasePath);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href={productsBasePath}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-heading font-bold text-foreground">
                            Create New Product
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Add a new product to your catalog
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{error}</p>
                </div>
            )}
            {successMessage && (
                <div className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
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
            />

        </div>
    );
}