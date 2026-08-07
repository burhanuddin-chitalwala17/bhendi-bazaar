// components/admin/products/productAdd/index.tsx

"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { ProductForm } from "@/components/shared/forms/product";
import { useProducts } from "../useProducts";
import type { ProductDetails } from "../types";

interface ProductEditContainerProps {
    product: ProductDetails;
    categories: { id: string; name: string }[];
    orgs: { id: string; name: string; code: string; defaultPincode: string; defaultCity: string; defaultState: string; defaultAddress: string }[];
}

export function ProductEditContainer({ product, categories, orgs }: ProductEditContainerProps) {
    const router = useRouter();
    const { updateProduct, isLoading, error, successMessage } = useProducts();

    const handleCancel = () => {
        router.push("/admin/products");
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/products"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-heading font-bold text-gray-900">
                            Edit Product: {product.name}
                        </h1>
                    </div>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{error}</p>
                </div>
            )}
            {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{successMessage}</p>
                </div>
            )}

            <ProductForm
                product={product}
                categories={categories}
                orgs={orgs}
                onSubmit={updateProduct}
                onCancel={handleCancel}
                isSubmitting={isLoading}
                readOnly={false}
            />

        </div>
    );
}