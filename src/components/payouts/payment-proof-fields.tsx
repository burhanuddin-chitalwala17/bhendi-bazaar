"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ImageUpload } from "@/components/shared/image-upload";
import { PAYMENT_METHODS } from "@server/payouts/credit.types";
import type { PaymentProofInput } from "./creditsApiClient";
import { PAYMENT_METHOD_LABEL, PAYMENT_PROOF_COPY } from "./credits-copy";

/** Today as a day key in the browser's own calendar — what "paid today" means to the person typing. */
export function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export const emptyProof = (): PaymentProofInput => ({ method: "UPI", reference: "", paidOn: todayKey(), receiptRef: null });

/**
 * How money moved outside the platform (ai-images/shop-credits D6, Q17, Q18): the same four fields
 * on a top-up and on a payout marked paid, so the two are recorded alike.
 */
export function PaymentProofFields({ value, onChange }: { value: PaymentProofInput; onChange: (next: PaymentProofInput) => void }) {
  const id = useId();
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${id}-method`}>{PAYMENT_PROOF_COPY.method}</Label>
        <Select id={`${id}-method`} value={value.method} onChange={(event) => onChange({ ...value, method: event.target.value as PaymentProofInput["method"] })}>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>{PAYMENT_METHOD_LABEL[method]}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-reference`}>{PAYMENT_PROOF_COPY.reference}</Label>
        <Input
          id={`${id}-reference`}
          value={value.reference}
          maxLength={120}
          placeholder={PAYMENT_PROOF_COPY.referenceHint}
          onChange={(event) => onChange({ ...value, reference: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-paid`}>{PAYMENT_PROOF_COPY.paidOn}</Label>
        <Input id={`${id}-paid`} type="date" value={value.paidOn} max={todayKey()} onChange={(event) => onChange({ ...value, paidOn: event.target.value })} />
      </div>
      <ImageUpload
        label={PAYMENT_PROOF_COPY.receipt}
        value={value.receiptRef ? [value.receiptRef] : []}
        onChange={(urls) => onChange({ ...value, receiptRef: urls[0] ?? null })}
        maxImages={1}
        uploadType="payments"
      />
    </div>
  );
}
