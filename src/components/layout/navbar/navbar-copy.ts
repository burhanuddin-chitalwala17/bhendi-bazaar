/** Words for navbar/ (ADR-0067): one object per component file, kept byte-identical to what it showed. */

/** Navbar.tsx */
export const NAVBAR_COPY = {
  browse: "Browse",
  saved: "Saved",
  signIn: "Sign in",
  backToBag: "Back to bag",
  checkout: "Checkout",
  secure: "Secure",
} as const;

/** NavbarSearch.tsx */
export const NAVBAR_SEARCH_COPY = {
  searchTheBazaar: "Search the bazaar",
  searchRidasAbayasShops: "Search ridas, abayas, shops",
  searching: "Searching",
  products: "Products",
  categories: "Categories",
} as const;

/** ProfileMenu.tsx */
export const PROFILE_MENU_COPY = {
  yourAccount: "Your account",
  emailNotVerified: "Email not verified",
  orders: "Orders",
  saved: "Saved",
  yourShop: "Your shop",
  signOut: "Sign out",
} as const;
