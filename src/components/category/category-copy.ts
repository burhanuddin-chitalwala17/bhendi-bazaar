/** Categories' words (ADR-0067): the store's lanes and breadcrumb, and the admin's list. */
export const CATEGORY_COPY = {
  nav: "Categories",
  breadcrumb: "Breadcrumb",
  home: "Home",
  console: {
    table: "Categories",
    edit: "Edit",
    editNamed: (name: string) => `Edit ${name}`,
    delete: "Delete",
    deleteNamed: (name: string) => `Delete ${name}`,
    searchPlaceholder: "Search categories…",
    searchLabel: "Search categories",
    search: "Search",
  },
} as const;

export const CATEGORY_FORM_COPY = {
  back: "Categories",
  editTitle: "Edit Category",
  createTitle: "Create New Category",
  editBody: "Update category details",
  createBody: "Add a new category to organize products",
  save: "Save Category",
} as const;

export const CATEGORIES_TABLE_COPY = {
  deleted: "Category deleted",
  orderSaved: "Order saved",
  heroImage: "Hero image",
} as const;

export const CATEGORY_FORM_RESULT_COPY = {
  updated: "Category updated successfully!",
  created: "Category created successfully!",
} as const;
