/** Checkout's words: the page, its three steps, the summary and Pay (ADR-0067). */
export const CHECKOUT_COPY = {
  title: "Checkout",
  backToBag: "Your bag",
  secure: "Secure",
  loading: "Loading checkout",
  buyNowGoneTitle: "That item is no longer available",
  buyNowGoneBody: "It may have sold out or been taken down. Your bag is unchanged.",
  backToShop: "Back to the shop",
  emptyTitle: "Nothing to check out",
  emptyBody: "Your bag is empty. Add something first.",
  backToYourBag: "Back to your bag",
  deliverTo: "Deliver to",
  haveAccount: "Already have an account?",
  signIn: "Sign in",
  delivery: "Delivery",
  deliveryParcels: (n: number) => `Delivery · ${n} parcels`,
  deliveryAfterAddress: "Delivery options appear once you add an address.",
  pay: "Pay",
  payExplainer: "Tap Pay to choose UPI, card, net banking or a wallet in Razorpay's secure window.",
  trustRazorpay: "Payments by Razorpay",
  trustReturns: "7-day returns",
  trustHelp: "Help from Account",
  inclDeliveryTaxes: "Incl. delivery and taxes",
  payAmount: (amount: string) => `Pay ${amount}`,
} as const;

/** What still stops Pay, by the step that fixes it (design-system Q20). */
export const CHECKOUT_STEP_COPY = {
  addAddress: "Add where we should deliver.",
  stillWorking: "Still working out delivery — try Pay again in a moment.",
  chooseOne: "Choose delivery for your parcel.",
  chooseMany: (n: number) => `Choose delivery for ${n} parcels.`,
} as const;

export const ADDRESS_PICKER_COPY = {
  noSaved: "You don't have any saved addresses.",
  addDelivery: "Add delivery address",
  choose: "Choose a delivery address",
  addNew: "Add new address",
  guestCaption: "Delivery Address",
} as const;

export const COUPON_COPY = {
  placeholder: "Coupon code",
  apply: "Apply",
  checking: "Checking…",
  remove: (code: string | null) => `Remove coupon ${code}`,
  covers: (covered: number, lines: number) => `Covers ${covered} of ${lines} items`,
  shortfall: (amount: string) => ` Add ${amount} more of the items it covers.`,
} as const;

export const SHIPPING_COPY = {
  parcels: (n: number) => `${n} parcels`,
  arriveIn: "Your order will arrive in",
  separateParcels: (n: number) => `${n} separate parcels`,
  differentLocations: "as items ship from different locations.",
  everythingBy: "Everything arrives by",
  parcelOf: (n: number, total: number) => `Parcel ${n} of ${total}`,
  shipsFrom: "Ships from",
  fromShop: (shop: string) => `From ${shop}`,
  items: "Items",
  billedAs: (kg: number) => `billed as ${kg} kg`,
  andMore: (n: number) => ` and ${n} more`,
  working: "Working out delivery…",
  notServiceable: "This shop doesn't deliver to this PIN code yet",
  choose: "Choose delivery",
} as const;

export const CHECKOUT_SUMMARY_COPY = {
  empty: "Your bag is empty.",
  title: (n: number) => `Order summary · ${n === 1 ? "1 item" : `${n} items`}`,
  offerApplied: "Offer applied",
  save: (amount: string) => `Save ${amount}`,
  subtotal: "Subtotal",
  offers: "Offers",
  delivery: "Delivery",
  afterAddress: "After your address",
  toPay: "To pay",
} as const;

export const CHECKOUT_PAYMENT_ERROR_COPY = {
  noRate: "Select a shipping option for every parcel before paying.",
  failed: "Checkout failed",
} as const;

export const CHECKOUT_VALIDATION_COPY = {
  emptyCart: "Cart is empty",
  noAddress: "Please select a delivery address",
} as const;

export const RAZORPAY_COPY = {
  description: "Order Payment",
} as const;
