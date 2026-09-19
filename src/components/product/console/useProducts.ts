// components/admin/productsContainer/hooks/useProducts.ts

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProductsApiClient } from "./productsApiClient";
import type { ProductFormInput } from "./types";
import { useProductsBasePath } from "./useProductsBasePath";

interface UseProductsOptions {
  onSuccess?: () => void;
}

export function useProducts(options?: UseProductsOptions) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const params = useParams();
  // Present under /org/[orgId]/..., absent under /admin/... — which is what selects the
  // API tree and where a successful write returns to.
  const orgId = typeof params.orgId === "string" ? params.orgId : undefined;
  const productsApiClient = new ProductsApiClient(orgId);
  const productsBasePath = useProductsBasePath();

  /**
   * Create Product
   */
  const createProduct = async (data: ProductFormInput) => {
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
        router.push(productsBasePath);
        router.refresh(); // Refresh server cache
      }, 1000);

      options?.onSuccess?.();
      return product;
    } catch (err) {
      // Presentation belongs to useServerForm, which maps field-level details
      // onto inputs. Rethrow untouched so those details survive.
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
        router.push(productsBasePath);
        router.refresh(); // Refresh server cache
      }, 1000);

      options?.onSuccess?.();
      return product;
    } catch (err) {
      // Presentation belongs to useServerForm; rethrow so field details survive.
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove a product. The server deletes it outright when nothing depends on it and
   * takes it off sale otherwise (ADR-0029), so the confirmation says both may happen
   * and the toast reports which one did.
   */
  const deleteProduct = async (id: string) => {
    if (
      !confirm(
        "Remove this product?\n\nIf it has never been ordered it is deleted permanently. If it appears on an order, a promotion or a bidding event it is taken off sale instead, so those records stay intact — you can restore it later.",
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const { outcome } = await productsApiClient.deleteProduct(id);
      toast.success(
        outcome === "archived"
          ? "Product taken off sale. Past orders keep it; restore it from the Withdrawn filter."
          : "Product deleted",
      );

      // ⚡ Trigger server refresh
      router.refresh();
      options?.onSuccess?.();
    } catch (error) {
      // ApiError extends Error, so this is the server's own message when there is one.
      toast.error(
        error instanceof Error ? error.message : "Could not remove the product",
      );
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /** Take a product off sale, or put it back, without touching what it was part of. */
  const setProductArchived = async (id: string, archived: boolean) => {
    setIsLoading(true);
    try {
      await productsApiClient.setArchived(id, archived);
      toast.success(
        archived ? "Product taken off sale" : "Product back on sale",
      );
      router.refresh();
      options?.onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : archived
            ? "Could not take the product off sale"
            : "Could not put the product back on sale",
      );
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // Mutations
    createProduct,
    deleteProduct,
    setProductArchived,
    updateProduct,
    // State
    isLoading,
    error,
    successMessage,
  };
}
