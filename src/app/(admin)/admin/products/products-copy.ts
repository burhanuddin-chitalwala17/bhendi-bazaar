/** The admin's product pages (ADR-0067). */
export const ADMIN_PRODUCTS_COPY = {
  metaTitle: "Admin: products",
  metaDescription: "Manage your product catalog",
  title: "Products",
  description: "Every shop's catalogue, for support. Shops manage their products in their own portal.",
  back: "Product",
  editTitle: (name: string) => `Edit for shop: ${name}`,
  teamEdited: (date: string) => `Edited by Bhendi Bazaar team · ${date}`,
  editForShop: "Edit for shop",
} as const;
