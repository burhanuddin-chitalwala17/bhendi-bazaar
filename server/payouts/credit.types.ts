import type { CreditLineKind as PrismaCreditLineKind, PaymentMethod as PrismaPaymentMethod } from "@prisma/client";

/**
 * A shop's credit for AI pictures (ai-images/shop-credits), as the browser and the other domains see
 * it. The closed sets mirror the Prisma enums; `satisfies` holds each mirror complete, because this
 * module is loaded in the browser and may not import the client as a value.
 */
export const CREDIT_LINE_KIND = {
  GRANT: "GRANT",
  TOP_UP: "TOP_UP",
  CHARGE: "CHARGE",
  ADJUSTMENT: "ADJUSTMENT",
  REFUND: "REFUND",
  REVERSAL: "REVERSAL",
} as const satisfies Record<PrismaCreditLineKind, PrismaCreditLineKind>;
export type CreditLineKind = (typeof CREDIT_LINE_KIND)[keyof typeof CREDIT_LINE_KIND];

export const PAYMENT_METHOD = {
  UPI: "UPI",
  BANK_TRANSFER: "BANK_TRANSFER",
  CASH: "CASH",
  OTHER: "OTHER",
} as const satisfies Record<PrismaPaymentMethod, PrismaPaymentMethod>;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];
export const PAYMENT_METHODS = Object.values(PAYMENT_METHOD);

/**
 * What a charged run is, for the words on its lines and its refusal. A picture unless said
 * otherwise; a caption since ai-images/social-posts D5.
 */
export const CREDIT_RUN = {
  PICTURE: { charge: "AI picture", settle: "AI picture, settled", refund: "Picture not made", short: "Not enough credit for this picture" },
  CAPTION: { charge: "AI caption", settle: "AI caption, settled", refund: "Caption not written", short: "Not enough credit for this caption" },
} as const;
export type CreditRun = (typeof CREDIT_RUN)[keyof typeof CREDIT_RUN];

/** ₹2,500 once (ai-images Q14), in paise. */
export const STARTING_CREDIT_PAISE = 250_000;
/** The largest single top-up, ₹10,00,000 (Q36): catches a mistyped zero. */
export const MAX_TOP_UP_PAISE = 100_000_000;
/** Margin in basis points: 10,000 is 100%. A margin above 100% is a typo, not a policy. */
export const MAX_MARGIN_BPS = 10_000;

/** The lines an admin may reverse: money that came in. Charges are the platform's own and settle themselves. */
export const REVERSIBLE_KINDS: readonly CreditLineKind[] = [CREDIT_LINE_KIND.GRANT, CREDIT_LINE_KIND.TOP_UP];

/** What a charge costs with margin: cost plus the margin rounded up to the paisa (Invariant 3; D4). */
export function withMargin(costPaise: number, marginBps: number): number {
  if (!Number.isInteger(costPaise) || !Number.isInteger(marginBps)) throw new Error("Money is integers");
  return costPaise + Math.ceil((costPaise * marginBps) / 10_000);
}

export interface CreditLineDto {
  id: string;
  kind: CreditLineKind;
  amountPaise: number;
  /** Shown to the admin only; null on the shop's own view. */
  providerCostPaise: number | null;
  marginBps: number | null;
  method: PaymentMethod | null;
  reference: string | null;
  paidOn: string | null;
  receiptRef: string | null;
  note: string | null;
  /** Set when this line has been reversed, so the admin is not offered a second reversal. */
  reversed: boolean;
  createdAt: string;
}

export interface PaymentDetailsDto {
  upiId: string | null;
  qrRef: string | null;
  accountName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  bankName: string | null;
}

/** The shop's credit sheet (R8, R11): balance, the latest lines, where to pay. */
export interface CreditAccountDto {
  balancePaise: number;
  lines: CreditLineDto[];
  hasMore: boolean;
  paymentDetails: PaymentDetailsDto;
}

/** The admin's view of one shop (R3, R6, R8). */
export interface AdminCreditAccountDto extends CreditAccountDto {
  /** The shop's own margin, or null where it follows the platform's. */
  marginOverrideBps: number | null;
  platformMarginBps: number;
  /** What this shop's AI pictures took from its credit this month, net of refunds. */
  spentThisMonthPaise: number;
}

/** Proof of money that moved outside the platform (D6): a top-up in, a payout out. */
export interface PaymentProof {
  method: PaymentMethod;
  reference: string;
  paidOn: Date;
  receiptRef: string | null;
}

/** Recording a settlement paid takes its proof (Q18); cancelling takes nothing. */
export type SettlementStatusChange = ({ status: "PAID" } & PaymentProof) | { status: "CANCELLED" };
