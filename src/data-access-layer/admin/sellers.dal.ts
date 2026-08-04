// src/components/admin/sellersContainer/sellers.dal.ts

import { cache } from "react";
import type { SellerWithStats } from "@/domain/seller";
import { sellerRepository } from "@server/catalog/seller.repository";

class SellersDAL {
    getSellers = cache(async (): Promise<SellerWithStats[]> => {
        const sellers = await sellerRepository.findAll(true);
        return sellers;
    });
}

export const sellersDAL = new SellersDAL();