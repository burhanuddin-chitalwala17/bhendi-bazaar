// components/admin/productsContainer/hooks/useProducts.ts

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProductsApiClient } from "./productsApiClient";
import type { ProductFormInput } from "./types";
import { useProductsBasePath } from "./useProductsBasePath";

interface UseProductsOptions {
  onSuccess?: () => void;
  /** The stepped create shows its own success screen, so a create neither toasts nor leaves (product-form Q16). */
  stayAfterCreate?: boolean;
  /** The edit overview toasts, refreshes and stays itself (product-form R7, D8). */
  stayAfterUpdate?: boolean;
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
      if (options?.stayAfterCreate) {
        router.refresh();
        options.onSuccess?.();
        return product;
      }

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
      if (options?.stayAfterUpdate) return product;
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
   * Delete a product permanently (ADR-0029). Refused, with the reason, when a record
   * depends on it — the caller shows that message and Archive is the way through.
   *
   * No `confirm()` here: the dialog that offers this action is the confirmation, and
   * it can say what deletion means in prose a native alert cannot format.
   */
  const deleteProduct = async (id: string) => {
    setIsLoading(true);
    try {
      await productsApiClient.deleteProduct(id);
      toast.success("Product deleted");

      // ⚡ Trigger server refresh
      router.refresh();
      options?.onSuccess?.();
    } catch (error) {
      // ApiError extends Error, so this is the server's own message when there is one.
      toast.error(
        error instanceof Error ? error.message : "Could not delete the product",
      );
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /** Archive a product, or restore it, without touching what it was part of. */
  const setProductArchived = async (id: string, archived: boolean) => {
    setIsLoading(true);
    try {
      await productsApiClient.setArchived(id, archived);
      toast.success(
        archived ? "Product archived" : "Product restored",
      );
      router.refresh();
      options?.onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : archived
            ? "Could not archive the product"
            : "Could not restore the product",
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
