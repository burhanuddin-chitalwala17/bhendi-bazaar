// components/admin/productsContainer/hooks/useProducts.ts

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProductsApiClient } from "./productsApiClient";
import type { ProductFormInput } from "./types";

interface UseProductsOptions {
  onSuccess?: () => void;
}

export function useProducts(options?: UseProductsOptions) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const productsApiClient = new ProductsApiClient();
  const params = useParams();

  /**
   * Create Product
   */
  const createProduct = async (data: ProductFormInput) => {
    // Client-side validation
    if (!data.images || data.images.length === 0) {
      const errorMsg = "At least one image is required";
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (!data.sellerId) {
      const errorMsg = "Seller is required";
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const product = await productsApiClient.createProduct(data);
      
      const successMsg = "Product created successfully!";
      setSuccessMessage(successMsg);
      toast.success(successMsg);

      // Navigate back after a short delay
      setTimeout(() => {
        router.push("/admin/products");
        router.refresh(); // Refresh server cache
      }, 1000);

      options?.onSuccess?.();
      return product;
    } catch (err: any) {
      const errorMsg = err.message || "Failed to create product";
      setError(errorMsg);
      toast.error(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProduct = async (data: ProductFormInput) => {
    const id = params.id as string;
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      const product = await productsApiClient.updateProduct(id as string, data);
      const successMsg = "Product updated successfully!";
      setSuccessMessage(successMsg);
      toast.success(successMsg);

      // Navigate back after a short delay
      setTimeout(() => {
        router.push("/admin/products");
        router.refresh(); // Refresh server cache
      }, 1000);

      options?.onSuccess?.();
      return product;
    }
    catch (err: any) {
      const errorMsg = err.message || "Failed to update product";
      setError(errorMsg);
      toast.error(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  const deleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) {
      return;
    }
    
    setIsLoading(true);
    try {
      await productsApiClient.deleteProduct(id);
      toast.success("Product deleted successfully");
      
      // ⚡ Trigger server refresh
      router.refresh();
      options?.onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete product");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    // Mutations
    createProduct,
    deleteProduct,
    updateProduct,
    // State
    isLoading,
    error,
    successMessage,
  };
}