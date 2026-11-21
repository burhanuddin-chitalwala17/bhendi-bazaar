/** The admin's shops console: the list, a shop's tabs, and the actions on it (ADR-0067). */
export const ORG_CONSOLE_COPY = {
  title: "Shops",
  count: (total: number) => `${total} ${total === 1 ? "shop" : "shops"} on the platform`,
  refresh: "Refresh",
  add: "Add shop",
  searchPlaceholder: "Search by name, code, email or city…",
  searchLabel: "Search shops",
  search: "Search",
  allStatuses: "All statuses",
  active: "Active",
  inactive: "Inactive",
  failed: "Shops didn't load",
  created: "Shop created",
  updated: "Shop updated",
  blocked: "Shop blocked",
  unblocked: "Shop unblocked",
  blockFailed: "The shop wasn't blocked",
  unblockFailed: "The shop wasn't unblocked",
  block: "Block",
  unblock: "Unblock",
} as const;

export const ORGS_TABLE_COPY = {
  shop: "Shop",
  contact: "Contact",
  phone: "Phone",
  products: "Products",
  productCount: (n: number) => `${n} products`,
  stock: "Stock",
  inStock: (n: number) => `${n} in stock`,
  status: "Status",
  blocked: "Blocked",
  actions: "Actions",
  view: "View",
  viewLabel: (name: string) => `View ${name}`,
  edit: "Edit",
  editLabel: (name: string) => `Edit ${name}`,
  toggleLabel: (blocked: boolean, name: string) => `${blocked ? "Unblock" : "Block"} ${name}`,
  label: "Shops",
} as const;

export const ORG_TABS_COPY = {
  label: "Shop sections",
  dashboard: "Dashboard",
  products: "Products",
  orders: "Orders",
  earnings: "Earnings",
  reviews: "Reviews",
  plan: "Plan",
  credits: "Credits",
} as const;

export const ORG_EARNINGS_COPY = {
  owed: "Shop is owed",
  unclaimed: (amount: string) => `${amount} not yet in a settlement`,
  commission: "Commission",
  defaultRate: "Default rate:",
  orders: (count: number) => `Orders (${count})`,
  noOrders: "No orders yet.",
  orderCommission: (amount: string) => `Commission: ${amount}`,
  settlements: "Settlements",
} as const;

export const ORG_REVIEWS_COPY = {
  empty: "No reviews yet",
  emptyHint: "Reviews of this shop's products appear here once buyers write them.",
  rated: (rating: number) => `Rated ${rating} of 5`,
  verified: "Verified buyer",
  on: (product: string) => `on ${product}`,
} as const;

export const ADD_ORG_TITLE_COPY = {
  edit: (name: string) => `Edit Org: ${name}`,
  view: (name: string) => `View Org: ${name}`,
  add: "Add New Organisation",
} as const;

export const ORGS_LOAD_COPY = {
  failed: "Shops didn't load",
} as const;
