// src/components/admin/sellersContainer/hooks/useSellers.ts

import { useState, useEffect, useCallback } from "react";
import { sellerService } from "@/services/admin/sellerService";
import type { SellerWithStats, CreateSellerInput } from "@/domain/seller";
import { toast } from "sonner";

export function useSellers() {
  const [sellers, setSellers] = useState<SellerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSellers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sellerService.getSellers(true); // with stats
      setSellers(data);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || "Failed to load sellers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSellers();
  }, [loadSellers]);

  const createSeller = async (data: CreateSellerInput) => {
    try {
      const newSeller = await sellerService.createSeller(data);
      toast.success("Seller created successfully");
      setSellers([...sellers, newSeller as SellerWithStats]);
    } catch (err) {
      // Presentation belongs to useServerForm; rethrow so field details survive.
      throw err;
    }
  };

  const updateSeller = async (id: string, data: Partial<CreateSellerInput>) => {
    try {
      const newSeller = (await sellerService.updateSeller(
        id,
        data
      )) as SellerWithStats;
      toast.success("Seller updated successfully");
      setSellers(
        sellers.map((seller: SellerWithStats) =>
          seller.id === id ? newSeller : seller
        )
      );
    } catch (err) {
      // Presentation belongs to useServerForm; rethrow so field details survive.
      throw err;
    }
  };

  const deleteSeller = async (id: string) => {
    try {
      await sellerService.deleteSeller(id);
      toast.success("Seller deleted successfully");
      setSellers(sellers.filter((seller: SellerWithStats) => seller.id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete seller");
      throw err;
    }
  };

  return {
    sellers,
    loading,
    error,
    createSeller,
    updateSeller,
    deleteSeller,
    refetch: loadSellers,
  };
}