// components/admin/productsContainer/hooks/useProducts.ts

import { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProductsApiClient } from "./productsApiClient";
import type { ProductFormInput } from "./types";
import { useProductsBasePath } from "./useProductsBasePath";
import { PRODUCT_CONSOLE_COPY } from "./console-copy";
import { ROUTES } from "@server/shared/routes";
import { PRODUCT_ACTIONS_COPY } from "@/components/product/console/console-copy";

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
  // Under /admin the team acts for a shop through its own routes (product-form D12).
  const team = !!usePathname()?.startsWith(`${ROUTES.admin.home}/`);
  const productsApiClient = new ProductsApiClient(orgId, team);
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

      const successMsg = PRODUCT_ACTIONS_COPY.created;
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
      const successMsg = PRODUCT_ACTIONS_COPY.updated;
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
      toast.success(PRODUCT_CONSOLE_COPY.toast.deleted);

      // ⚡ Trigger server refresh
      router.refresh();
      options?.onSuccess?.();
    } catch (error) {
      // ApiError extends Error, so this is the server's own message when there is one.
      toast.error(
        error instanceof Error ? error.message : PRODUCT_CONSOLE_COPY.toast.deleteFailed,
      );
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /** The team restores an archived shop product, then reloads the edit page into the form. */
  const restoreForShop = async (id: string) => {
    setIsLoading(true);
    try {
      await productsApiClient.restoreForShop(id);
      toast.success(PRODUCT_CONSOLE_COPY.toast.restored);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : PRODUCT_ACTIONS_COPY.restoreFailed);
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
        archived ? PRODUCT_ACTIONS_COPY.archived : PRODUCT_ACTIONS_COPY.restored,
      );
      router.refresh();
      options?.onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : archived
            ? PRODUCT_ACTIONS_COPY.archiveFailed
            : PRODUCT_ACTIONS_COPY.restoreFailed,
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
    restoreForShop,
    updateProduct,
    // State
    isLoading,
    error,
    successMessage,
  };
}
