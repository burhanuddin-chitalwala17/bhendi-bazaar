import { apiRequest } from "@/lib/api-client";
import type { AdminCreditAccountDto, CreditAccountDto, PaymentDetailsDto, PaymentMethod } from "@server/payouts/credit.types";

/** The proof a top-up or a paid settlement carries, as the browser sends it (shop-credits D6). */
export interface PaymentProofInput {
  method: PaymentMethod;
  reference: string;
  /** A day key, `YYYY-MM-DD`. */
  paidOn: string;
  receiptRef: string | null;
}

/** A shop's credit for AI pictures: its own sheet, and the admin's side (ai-images/shop-credits). */
export const creditsApiClient = {
  account: (orgId: string, page = 1, signal?: AbortSignal) =>
    apiRequest<CreditAccountDto>(`/api/org/${orgId}/credits?page=${page}`, { signal }),

  adminAccount: (orgId: string, page = 1, signal?: AbortSignal) =>
    apiRequest<AdminCreditAccountDto>(`/api/admin/orgs/${orgId}/credits?page=${page}`, { signal }),

  recordTopUp: (orgId: string, input: PaymentProofInput & { amountPaise: number }) =>
    apiRequest<AdminCreditAccountDto>(`/api/admin/orgs/${orgId}/credits`, { method: "POST", body: input }),

  reverse: (orgId: string, lineId: string, reason: string) =>
    apiRequest<AdminCreditAccountDto>(`/api/admin/orgs/${orgId}/credits/${lineId}/reverse`, { method: "POST", body: { reason } }),

  setOrgMargin: (orgId: string, marginBps: number | null) =>
    apiRequest<AdminCreditAccountDto>(`/api/admin/orgs/${orgId}/credits/margin`, { method: "PUT", body: { marginBps } }),

  setPlatformMargin: (marginBps: number) =>
    apiRequest<{ marginBps: number }>("/api/admin/credits/settings", { method: "PUT", body: { marginBps } }),

  savePaymentDetails: (details: PaymentDetailsDto) =>
    apiRequest<PaymentDetailsDto>("/api/admin/payment-details", { method: "PUT", body: details }),
};
