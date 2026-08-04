// src/services/categoryApiClient.ts
import type { Category } from "@/domain/category";

class CategoryService {
  private baseUrl = "/api/categories";

  async getCategories(): Promise<Category[]> {
    const response = await fetch(this.baseUrl);
    if (!response.ok) throw new Error("Failed to fetch categories");
    return response.json();
  }

}

export const categoryApiClient = new CategoryService();