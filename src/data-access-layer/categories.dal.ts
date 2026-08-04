// create a category dal to get categories and category by slug

import { cache } from "react";
import { categoryRepository } from "@server/catalog/category.repository";
import { Category } from "@/domain/category";

class CategoriesDAL {
    
    getCategories = cache(async (): Promise<Category[]> => {
        const categories = await categoryRepository.list();
        return categories;
    });

    getCategoryById = cache(async (id: string): Promise<Category> => {
        const category = await categoryRepository.findById(id);
        if (!category) {
            throw new Error("Category not found");
        }
        return category;
    });

    getCategoryBySlug = cache(async (slug: string): Promise<Category> => {
        const category = await categoryRepository.findBySlug(slug);
        if (!category) {
            throw new Error("Category not found");
        }
        return category;
    });
}

export const categoriesDAL = new CategoriesDAL();