"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormController, FormInput } from "@/components/shared/forms/FormField";
import { useServerForm } from "@/hooks/core/useServerForm";
import { enhancementsApiClient } from "@/components/content/enhancementsApiClient";
import { paiseToRupees, rupeesToPaise } from "@/lib/format";
import {
  enhancementSettingsSchema,
  type EnhancementSettingsInput,
} from "@/lib/validation/schemas/enhancement.schema";
import type { EnhancementSettingsDto } from "@server/content/enhancement.types";
import { ENHANCEMENT_COPY } from "./enhancement-copy";

/**
 * The platform's two numbers (image-enhancement spec R7, trd D5): how many enhancements a shop
 * gets in a month unless its own row says otherwise, and what every shop together may spend in a
 * day. Saved through the schema the route parses (ADR-0013), so what is refused here is what is
 * refused there.
 */
export function EnhancementSettingsForm({ settings }: { settings: EnhancementSettingsDto }) {
  const router = useRouter();
  const {
    register,
    control,
    onSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<EnhancementSettingsInput>({
    schema: enhancementSettingsSchema,
    defaultValues: {
      defaultMonthlyAllowance: settings.defaultMonthlyAllowance,
      dailyCapPaise: settings.dailyCapPaise,
    },
    submit: (data) => enhancementsApiClient.saveSettings(data),
    successMessage: ENHANCEMENT_COPY.settings.saved,
    onSuccess: () => router.refresh(),
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          label={ENHANCEMENT_COPY.settings.monthlyAllowance}
          type="number"
          inputMode="numeric"
          step="1"
          min={1}
          {...register("defaultMonthlyAllowance", { valueAsNumber: true })}
          error={errors.defaultMonthlyAllowance?.message}
          hint={ENHANCEMENT_COPY.settings.monthlyAllowanceHint}
        />
        <FormController
          name="dailyCapPaise"
          control={control}
          label={ENHANCEMENT_COPY.settings.dailyCap}
          error={errors.dailyCapPaise?.message}
          hint={ENHANCEMENT_COPY.settings.dailyCapHint}
          render={({ field }) => (
            <RupeeInput
              paise={typeof field.value === "number" ? field.value : 0}
              onPaiseChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? ENHANCEMENT_COPY.saving : ENHANCEMENT_COPY.save}
        </Button>
      </div>
    </form>
  );
}

/**
 * Rupees in, paise out — the one conversion, at the boundary (ADR-0004). What is typed is kept as
 * typed until it is sent: reformatting a half-typed "50." back into the box fights the person.
 */
/** What the box shows for an amount, as typed rupees. */
function rupeesText(paise: number): string {
  return String(paiseToRupees(paise));
}

function RupeeInput({
  paise,
  onPaiseChange,
  onBlur,
}: {
  paise: number;
  onPaiseChange: (paise: number) => void;
  onBlur: () => void;
}) {
  const [typed, setTyped] = useState(() => rupeesText(paise));

  return (
    <Input
      type="number"
      inputMode="decimal"
      step="1"
      min={1}
      value={typed}
      onBlur={onBlur}
      onChange={(event) => {
        setTyped(event.target.value);
        onPaiseChange(rupeesToPaise(Number(event.target.value)));
      }}
    />
  );
}
