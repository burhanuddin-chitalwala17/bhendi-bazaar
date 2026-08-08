// components/admin/products/productView/index.tsx

"use client";

import { ArrowLeft, Edit, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/shared/forms/product";
import type { ProductDetails } from "./types";
import { useRouter } from "next/navigation";
import { useProductsBasePath } from "@/admin/products/useProductsBasePath";

interface ProductViewProps {
  product: ProductDetails;
  category: { id: string; name: string };
  org: { id: string; name: string; code: string; defaultPincode: string; defaultCity: string; defaultState: string; defaultAddress: string };
}

export function ProductsView({ product, category, org }: ProductViewProps) {
  const router = useRouter();
  const productsBasePath = useProductsBasePath();
  const onCancel = () => {
    router.push(productsBasePath);
  };
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={productsBasePath}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-heading font-bold text-gray-900">
              {product.name}
            </h1>
            <p className="text-gray-600 mt-1">Product Details</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Link href={`/product/${product.slug}`} target="_blank">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              View Live
            </Button>
          </Link>
          <Link href={`${productsBasePath}/${product.id}/edit`}>
            <Button className="gap-2">
              <Edit className="w-4 h-4" />
              Edit Product
            </Button>
          </Link>
        </div>
      </div>

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