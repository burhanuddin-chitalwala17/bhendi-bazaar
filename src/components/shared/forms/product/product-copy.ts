import type { PRODUCT_FORM_FIELDS } from "@/lib/validation/schemas/product.schema";

type ProductFormField = (typeof PRODUCT_FORM_FIELDS)[number];
/** Words for product/ (ADR-0067): one object per component file, kept byte-identical to what it showed. */

/** ProductSections.tsx */
export const PRODUCT_SECTIONS_COPY = {
  name: "Name",
  eGVelvetEmbroideredKurta: "e.g., Velvet Embroidered Kurta",
  description: "Description",
  whatItIsWhatIt: "What it is, what it is made of, how it is used",
  price: "Price (₹)",
  salePrice: "Sale price (₹)",
  optional: "Optional",
  leaveEmptyIfItIs: "Leave empty if it is not on sale.",
  thePrintedPriceEveryMarketplace: "The printed price. Every marketplace shows the same MRP.",
  packedWeightKg: "Packed weight (kg)",
  withItsPacking06: "With its packing. 0.6 means 600 g.",
  skuYourOwnCode: "SKU (your own code)",
  eGVek001: "e.g., VEK-001",
  barcodeEanUpcOrIsbn: "Barcode (EAN, UPC or ISBN)",
  leaveBlankIfTheProduct: "Leave blank if the product has none",
  tellMeWhenStockIs: "Tell me when stock is below",
  whatOtherPlacesAsk: "What other places ask",
  whereItWillSell: "Where it will sell",
  tags: "Tags",
  wordsBuyersMightSearchFor: "Words buyers might search for, separated by commas.",
  attarVelvetFestive: "attar, velvet, festive",
  checking: "Checking…",
  readyForYourStore: "Ready for your store",
  moreOptions: "More options",
} as const;

/** BuyerPreview.tsx */
export const BUYER_PREVIEW_COPY = {
  video: "Video",
  noCoverYet: "No cover yet",
  more: "More",
} as const;

/** CategoryPicker.tsx */
export const CATEGORY_PICKER_COPY = {
  category: "Category",
  searchCategories: "Search categories",
  recent: "Recent",
  allCategories: "All categories",
  placeholder: "Pick a category",
} as const;

/** DraftNotice.tsx */
export const DRAFT_NOTICE_COPY = {
  useIt: "Use it",
} as const;

/** KeyFeaturesField.tsx */
export const KEY_FEATURES_FIELD_COPY = {
  eGSoftNidaFalls: "e.g., Soft Nida, falls without clinging",
  keyFeatures: "Key features",
  upToFiveShortPoints: "Up to five short points buyers see first",
} as const;

/** LeaveSheet.tsx */
export const LEAVE_SHEET_COPY = {
  leaveWithoutSaving: "Leave without saving?",
  keepEditing: "Keep editing",
  leave: "Leave",
} as const;

/** ProductBasicFields.tsx */
export const PRODUCT_BASIC_FIELDS_COPY = {
  productName: "Product Name",
  eGVelvetEmbroideredKurta: "e.g., Velvet Embroidered Kurta",
  description: "Description",
  detailedProductDescription: "Detailed product description...",
  category: "Category",
  eGVek001: "e.g., VEK-001",
  optionalMustBeUnique: "Optional — must be unique",
  basicInformation: "Basic Information",
  selectACategory: "Select a category",
} as const;

/** ProductEditOverview.tsx */
export const PRODUCT_EDIT_OVERVIEW_COPY = {
  sections: "Sections",
  buyerPreview: "Buyer preview",
  tapASectionToChange: "Tap a section to change it.",
  allSections: "All sections",
  thisIsHowBuyersWill: "This is how buyers will see it.",
  tryAgain: "Try again",
} as const;

/** ProductFactFields.tsx */
export const PRODUCT_FACT_FIELDS_COPY = {
  // Every question open, narrowed by a chip (listing-model Q35). Required is bhendi-bazaar.com's alone.
  filterLabel: "Show",
  filterChip: { all: "All", required: "Required", amazon: "Amazon", flipkart: "Flipkart", meesho: "Meesho" } as Record<string, string>,
  filled: (done: number, total: number) => `${done}/${total}`,
  filledSr: "filled",
  filterBody: {
    all: "Everything a buyer or a marketplace may ask. Leave anything you do not know — it saves either way.",
    required: "What bhendi-bazaar.com needs before it shows this product.",
    channel: (name: string) => `What ${name} asks about this kind of thing. It saves either way.`,
  },
  channelShort: { store: "This store", amazon: "Amazon", flipkart: "Flipkart", meesho: "Meesho", google: "Google", meta: "Meta" } as Record<string, string>,
  kind: "Kind",
  productDetails: "Product details",
  whatAMarketplaceAsksAbout: "What a marketplace asks about this kind of thing. Leave anything you do not know — it saves either way.",
  notSpecified: "Not specified",
  measurements: "Measurements",
  noProductType: "This category has no product type, so there is nothing more to ask. The product saves and sells here; it cannot be published to a marketplace until a type is set.",
} as const;

/** ProductFamilyField.tsx */
export const PRODUCT_BRAND_FIELD_COPY = {
  label: "Brand",
  hint: "Who makes it, who packs it and where it's from come from the brand. Marketplaces ask for them.",
  none: "Your default brand",
  noBrands: "No brands yet.",
  addBrand: "Add one in Brands and defaults",
} as const;

export const PRODUCT_INHERITED_FIELDS_COPY = {
  title: "Who makes it and where it's from",
  labels: { countryOfOrigin: "Country of origin", manufacturer: "Maker", packer: "Packer", importer: "Importer" },
  fromBrand: (name: string, value: string) => `From your brand ${name}: ${value}`,
  fromShop: (value: string) => `From your shop defaults: ${value}`,
  brandSilent: (name: string) => `Your brand ${name} doesn't say`,
  nothingYet: "Not given yet",
  setOnProduct: "Set on this product",
  change: "Change",
  revertToBrand: "Use brand's",
  revertToShop: "Use shop's",
  partyPlaceholder: "Name, address, pincode",
} as const;

export const PRODUCT_FAMILY_FIELD_COPY = {
  partOfAFamily: "Part of a family",
  forTheSameThingIn: "For the same thing in several colours or sizes. Most products need none.",
  familyName: "Family name",
  eGNidaMatteAbaya: "e.g. Nida Matte Abaya",
  whatTheColoursHaveIn: "What the colours have in common, not one of them",
  onItsOwn: "On its own",
  startANewFamily: "Start a new family",
  cancel: "Cancel",
} as const;

/** ProductFlagsFields.tsx */
export const PRODUCT_FLAGS_FIELDS_COPY = {
  productFlags: "Product Flags",
} as const;

/** ProductInventoryFields.tsx */
export const PRODUCT_INVENTORY_FIELDS_COPY = {
  lowStockThreshold: "Low Stock Threshold",
  alertWhenStockFallsBelow: "Alert when stock falls below this number",
  weightKg: "Weight (kg)",
  kilogramsDecimalsAllowed06: "Kilograms, decimals allowed — 0.6 means 600 g. Parcels are billed at the summed weight rounded up to whole kg.",
  inventory: "Inventory",
} as const;

/** ProductOrgShippingFields.tsx */
export const PRODUCT_ORG_SHIPPING_FIELDS_COPY = {
  organisation: "Organisation",
  selectAnOrganisation: "Select an organisation",
} as const;

/** ProductPricingFields.tsx */
export const PRODUCT_PRICING_FIELDS_COPY = {
  regularPrice: "Regular Price (₹)",
  salePrice: "Sale Price (₹)",
  optional: "Optional",
  sellsAtThisInsteadLeave: "Sells at this instead. Leave empty if not on sale; schedule or stop it under Offers.",
  currency: "Currency",
  pricing: "Pricing",
} as const;

/** ProductStepsForm.tsx */
export const PRODUCT_STEPS_FORM_COPY = {
  steps: "Steps",
  stillToFix: "Still to fix",
  buyerPreview: "Buyer preview",
  tryAgain: "Try again",
  back: "Back",
  next: "Next",
  onSaleNow: "On sale now",
  shareOnWhatsapp: "Share on WhatsApp",
  addAnother: "Add another",
  copyThisOne: "Copy this one",
  viewProduct: "View product",
  introPhotos: "Start with photos. Tap 'Cover' on the one buyers see first.",
  introReview: "This is how buyers will see it.",
  save: "Put on sale",
} as const;

/** TeamBanner.tsx */
export const TEAM_BANNER_COPY = {
  whyAreYouChangingThis: "Why are you changing this?",
} as const;

/** index.tsx */
export const INDEX_COPY = {
  photosAndVideo: "Photos and video",
  gallery: "Gallery",
  close: "Close",
} as const;

/** Each field as the shop reads it, for "your changes to …" (product-form D8, D10). Typed like FIELD_STEP. */
export const FIELD_LABEL: Record<ProductFormField, string> = {
  media: "Photos and video",
  name: "Name",
  description: "Description",
  categoryId: "Category",
  tags: "Tags",
  flags: "Flags",
  familyId: "Family",
  price: "Price",
  salePrice: "Sale price",
  currency: "Currency",
  orgId: "Shop",
  stockLocations: "Stock",
  weight: "Packed weight",
  sku: "SKU",
  mrp: "MRP",
  barcode: "Barcode",
  keyFeatures: "Key features",
  lowStockThreshold: "Low-stock alert",
  kind: "Kind",
  brandId: "Brand",
  facts: "Details",
  measurements: "Measurements",
  sizes: "Sizes",
  colors: "Colours",
};

export const PRODUCT_STEP_COPY = {
  photos: "Photos and video",
  what: "What it is",
  price: "Price & stock",
  details: "Details",
  review: "Review",
  thingsToFix: (count: number) => `${count} ${count === 1 ? "thing" : "things"} to fix`,
} as const;

export const EDIT_OVERVIEW_SUMMARY_COPY = {
  noPhotos: "No photos yet",
  noDetails: "No details yet",
  review: "How buyers see it",
  detailsAnswered: (details: string) => `${details} answered`,
  onSale: (price: string) => `${price} on sale`,
  priceLine: (shown: string, stock: number) => `${shown} · ${stock} in stock`,
} as const;

export const PRODUCT_FORM_SAVE_COPY = {
  failed: "Couldn't save. Try again.",
  failedNew: "Couldn't save. Your work is still here.",
  failedEdit: "Couldn't save. Your changes are still here.",
  teamSave: "Save for shop",
  teamPublish: "Put on sale for shop",
} as const;

export const PRODUCT_EDIT_OVERVIEW_SAVE_COPY = {
  save: "Save changes",
} as const;

export const ORG_SHIPPING_FIELDS_COPY = {
  orgRequired: "Organisation is required",
  titleFixed: "Stock locations",
  title: "Org & Stock Locations",
  bodyFixed: "Say where this product physically sits — the customer only ever sees the total.",
  body: "Choose the organisation, then say where this product physically sits — nothing is preselected, and the customer only ever sees the total.",
  noLocationFixed: "Where is this kept? Add your shop address once.",
  noLocation: "Choose the organisation to see where its stock can sit.",
  add: "Add location",
  addAnother: "Add another location",
} as const;

export const DRAFT_NOTICE_ACTION_COPY = {
  startFresh: "Start fresh",
  discard: "Discard",
} as const;

export const PRICING_RULES_COPY = {
  required: "Price is required",
  min: "Price must be greater than 0",
} as const;

export const KEY_FEATURES_ADD_COPY = {
  add: "Add a point",
  full: "Five is the most a marketplace shows",
} as const;

export const BASIC_FIELDS_RULES_COPY = {
  name: "Product name is required",
  description: "Description is required",
  category: "Category is required",
} as const;
