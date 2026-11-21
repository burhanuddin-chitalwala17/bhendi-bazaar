"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/core/useMutation";
import { creditsApiClient } from "./creditsApiClient";
import { PAYMENT_DETAILS_COPY } from "./credits-copy";

/** The platform's margin on AI pictures, for every shop without its own (shop-credits R6, Q15). */
export function PlatformMarginForm({ initialBps }: { initialBps: number }) {
  const [percent, setPercent] = useState(String(initialBps / 100));
  const save = useMutation((marginBps: number) => creditsApiClient.setPlatformMargin(marginBps), {
    successMessage: PAYMENT_DETAILS_COPY.marginSaved,
  });
  return (
    <Card className="space-y-3 p-4 sm:p-6">
      <div className="space-y-1">
        <h2 className="font-heading text-title font-semibold">{PAYMENT_DETAILS_COPY.marginTitle}</h2>
        <p className="text-small text-muted-foreground">{PAYMENT_DETAILS_COPY.marginDescription}</p>
      </div>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const typed = percent.trim() || "0";
          if (!/^\d{1,3}(\.\d{1,2})?$/.test(typed)) {
            toast.error(PAYMENT_DETAILS_COPY.marginInvalid);
            return;
          }
          // Percent with up to two decimals, stored as basis points.
          save.mutate(Math.round(Number(typed) * 100)).catch(() => {});
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="platform-margin">{PAYMENT_DETAILS_COPY.marginLabel}</Label>
          <Input id="platform-margin" inputMode="decimal" value={percent} onChange={(event) => setPercent(event.target.value)} />
        </div>
        <Button type="submit" pending={save.isLoading}>
          {PAYMENT_DETAILS_COPY.saveMargin}
        </Button>
      </form>
    </Card>
  );
}
