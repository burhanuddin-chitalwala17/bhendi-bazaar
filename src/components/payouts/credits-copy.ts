import type { CreditLineKind, PaymentMethod } from "@server/payouts/credit.types";

/** What a shop and the admin read about credit for AI pictures (ai-images/shop-credits ux.md). */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  OTHER: "Other",
};

export const CREDIT_LINE_LABEL: Record<CreditLineKind, string> = {
  GRANT: "Starting credit",
  TOP_UP: "Top-up",
  CHARGE: "AI picture",
  ADJUSTMENT: "AI picture, another model",
  REFUND: "Refund — picture not made",
  REVERSAL: "Reversal",
};

export const PAYMENT_PROOF_COPY = {
  method: "Method",
  reference: "Transaction reference",
  referenceHint: "UTR, cheque or receipt number",
  paidOn: "Paid on",
  receipt: "Receipt (optional)",
} as const;

export const SHOP_CREDITS_COPY = {
  button: (balance: string) => `Credits · ${balance}`,
  title: "Credits",
  description: "What AI pictures cost, and what is left.",
  left: "left",
  low: "Running low — top up to keep making AI pictures",
  note:
    "AI pictures are paid from credit, at what each picture costs the platform. To top up, pay by UPI or bank transfer below, then send us the payment reference — we add it within a working day.",
  howToPay: "How to pay",
  upiId: "UPI ID",
  qrAlt: "UPI QR code for Bhendi Bazaar",
  accountName: "Account name",
  accountNumber: "Account number",
  ifsc: "IFSC",
  bank: "Bank",
  copy: "Copy",
  copied: "Copied",
  noDetails: "Ask us for the payment details through Talk to us.",
  talkToUs: "Talk to us",
  topUpSubject: "Credit top-up",
  topUpMessage: (shop: string) => `I've paid for a credit top-up for ${shop}. Amount: … Reference: …`,
  history: "History",
  loadMore: "Show more",
  loadFailed: "Couldn't load your credits",
  retry: "Try again",
} as const;

export const ADMIN_CREDITS_COPY = {
  tab: "Credits",
  balance: "Balance",
  spentThisMonth: (amount: string) => `AI pictures this month: ${amount}`,
  margin: (bps: number) => `Margin on AI pictures: ${bps / 100}%`,
  platformDefault: " (platform default)",
  forThisShop: " for this shop",
  change: "Change",
  marginTitle: "Margin for this shop",
  marginLabel: "Margin, %",
  marginHint: "Added to what each AI picture costs the platform. Empty follows the platform's margin.",
  useDefault: "Back to platform default",
  saveMargin: "Save margin",
  marginSaved: "Margin saved",
  recordTopUp: "Record top-up",
  topUpTitle: "Record top-up",
  amount: "Amount (₹)",
  record: "Record",
  recorded: (amount: string, shop: string) => `${amount} added to ${shop}`,
  reverse: "Reverse…",
  reverseTitle: (kind: string, date: string) => `Reverse ${kind} of ${date}?`,
  reverseBody: "The line stays; a reversal is added beside it.",
  reason: "Why?",
  reverseAction: "Reverse",
  reversed: "Line reversed",
  alreadyReversed: "Reversed",
  cost: (cost: string, bps: number) => `cost ${cost} · margin ${bps / 100}%`,
  loadMore: "Show more",
} as const;

export const PAYMENT_DETAILS_COPY = {
  title: "Payment details",
  description: "Where shops send a top-up for AI picture credit. Shops see exactly what is saved here.",
  upiId: "UPI ID",
  upiHint: "Like name@bank",
  qr: "UPI QR code",
  accountName: "Account name",
  accountNumber: "Account number",
  ifsc: "IFSC",
  bankName: "Bank",
  save: "Save",
  saved: "Payment details saved",
  marginTitle: "Margin on AI pictures",
  marginDescription: "Added to what each AI picture costs the platform, for every shop without a margin of its own. 0% charges shops exactly the cost.",
  marginLabel: "Margin, %",
  saveMargin: "Save margin",
  marginSaved: "Margin saved",
} as const;
