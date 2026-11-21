"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/shared/image-upload";
import { useMutation } from "@/hooks/core/useMutation";
import type { PaymentDetailsDto } from "@server/payouts/credit.types";
import { creditsApiClient } from "./creditsApiClient";
import { PAYMENT_DETAILS_COPY } from "./credits-copy";

const TEXT_FIELDS = [
  { key: "upiId", label: PAYMENT_DETAILS_COPY.upiId, hint: PAYMENT_DETAILS_COPY.upiHint },
  { key: "accountName", label: PAYMENT_DETAILS_COPY.accountName },
  { key: "accountNumber", label: PAYMENT_DETAILS_COPY.accountNumber, numeric: true },
  { key: "ifsc", label: PAYMENT_DETAILS_COPY.ifsc },
  { key: "bankName", label: PAYMENT_DETAILS_COPY.bankName },
] as const;

/** The platform's UPI id, QR code and bank account (shop-credits R11). Blank fields are simply not shown to shops. */
export function PaymentDetailsForm({ initial }: { initial: PaymentDetailsDto }) {
  const [details, setDetails] = useState(initial);
  const save = useMutation((next: PaymentDetailsDto) => creditsApiClient.savePaymentDetails(next), {
    successMessage: PAYMENT_DETAILS_COPY.saved,
    onSuccess: setDetails,
  });

  return (
    <Card className="p-4 sm:p-6">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(details).catch(() => {});
        }}
      >
        {TEXT_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={`pd-${field.key}`}>{field.label}</Label>
            <Input
              id={`pd-${field.key}`}
              value={details[field.key] ?? ""}
              inputMode={"numeric" in field ? "numeric" : undefined}
              placeholder={"hint" in field ? field.hint : undefined}
              onChange={(event) => setDetails({ ...details, [field.key]: event.target.value })}
            />
          </div>
        ))}
        <ImageUpload
          label={PAYMENT_DETAILS_COPY.qr}
          value={details.qrRef ? [details.qrRef] : []}
          onChange={(urls) => setDetails({ ...details, qrRef: urls[0] ?? null })}
          maxImages={1}
          uploadType="payments"
        />
        <Button type="submit" className="w-full sm:w-auto" pending={save.isLoading}>
          {PAYMENT_DETAILS_COPY.save}
        </Button>
      </form>
    </Card>
  );
}
