/** Words for category/ (ADR-0067): one object per component file, kept byte-identical to what it showed. */

/** CategoryBasicFields.tsx */
export const CATEGORY_BASIC_FIELDS_COPY = {
  categoryName: "Category Name",
  eGKurtas: "e.g., Kurtas",
  description: "Description",
  detailedCategoryDescription: "Detailed category description...",
  parentCategory: "Parent Category",
  leaveEmptyForATop: "Leave empty for a top-level category",
  productType: "Product type",
  displayOrder: "Display Order",
  lowerNumbersAppearFirst: "Lower numbers appear first",
  basicInformation: "Basic Information",
  noneTopLevel: "None — top level",
  inheritFromParent: "Inherit from parent",
} as const;

/** CategoryImageField.tsx */
export const CATEGORY_IMAGE_FIELD_COPY = {
  categoryHeroImage: "Category Hero Image",
  heroImage: "Hero image",
  thisImageWillBeDisplayed: "This image will be displayed on the category page header. Recommended size: 1920x600px",
} as const;

/** CategoryStylingFields.tsx */
export const CATEGORY_STYLING_FIELDS_COPY = {
  accentColor: "Accent Color",
  styling: "Styling",
  preview: "Preview",
} as const;

export const CATEGORY_BASIC_RULES_COPY = {
  name: "Category name is required",
  description: "Description is required",
  typeHintRoot: "Decides which listing questions its products are asked.",
  typeHintChild: "Decides which listing questions its products are asked. Left empty, this category inherits from its parent — and if no ancestor sets one either, products here save and sell on the storefront but cannot be published to a marketplace.",
} as const;
