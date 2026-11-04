"use client";

import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormController } from "@/components/shared/forms/FormField";
import { useServerForm } from "@/hooks/core/useServerForm";
import { enhancementsApiClient } from "@/components/content/enhancementsApiClient";
import {
  orgEnhancementPolicySchema,
  type OrgEnhancementPolicyInput,
} from "@/lib/validation/schemas/enhancement.schema";
import type { OrgEnhancementUsage } from "@server/content/enhancement.types";
import { ENHANCEMENT_COPY } from "./enhancement-copy";

/**
 * What one shop does differently (image-enhancement spec R7, A5): a number of its own, a pause
 * with the reason its members will read, or neither — and neither leaves no row at all, so a shop
 * that is exactly the platform default is not carrying a copy of a number that can go stale.
 */
export function OrgEnhancementPolicyForm({
  org,
  platformDefault,
}: {
  org: OrgEnhancementUsage;
  platformDefault: number;
}) {
  const router = useRouter();
  const {
    control,
    watch,
    setValue,
    onSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<OrgEnhancementPolicyInput>({
    schema: orgEnhancementPolicySchema,
    defaultValues: {
      monthlyAllowance: org.monthlyAllowanceOverride,
      paused: org.paused,
      pauseReason: org.pauseReason,
    },
    submit: (data) => enhancementsApiClient.saveOrgPolicy(org.orgId, data),
    successMessage: ENHANCEMENT_COPY.policy.saved(org.name),
    onSuccess: () => router.refresh(),
  });
  const paused = watch("paused");

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <FormController
        name="monthlyAllowance"
        control={control}
        label={ENHANCEMENT_COPY.policy.allowance}
        error={errors.monthlyAllowance?.message}
        hint={ENHANCEMENT_COPY.policy.allowanceHint(platformDefault)}
        render={({ field }) => (
          <Input
            type="number"
            inputMode="numeric"
            step="1"
            min={1}
            placeholder={String(platformDefault)}
            value={typeof field.value === "number" ? field.value : ""}
            onBlur={field.onBlur}
            onChange={(event) =>
              field.onChange(event.target.value === "" ? null : Number(event.target.value))
            }
          />
        )}
      />

      <FormController
        name="paused"
        control={control}
        label={ENHANCEMENT_COPY.policy.paused}
        error={errors.paused?.message}
        render={({ field }) => (
          <div className="flex min-h-10 items-center gap-3">
            <Switch
              checked={field.value === true}
              onCheckedChange={(next) => {
                field.onChange(next);
                // A lifted pause carries no reason: leaving it would resurface on the next pause.
                if (!next) setValue("pauseReason", null);
              }}
              aria-label={ENHANCEMENT_COPY.policy.pauseFor(org.name)}
            />
            <span className="text-sm text-muted-foreground">
              {paused ? ENHANCEMENT_COPY.policy.pausedOn : ENHANCEMENT_COPY.policy.pausedOff}
            </span>
          </div>
        )}
      />

      {paused && (
        <FormController
          name="pauseReason"
          control={control}
          label={ENHANCEMENT_COPY.policy.reason}
          error={errors.pauseReason?.message}
          render={({ field }) => (
            <Input
              placeholder={ENHANCEMENT_COPY.policy.reasonPlaceholder}
              maxLength={200}
              value={typeof field.value === "string" ? field.value : ""}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(event.target.value === "" ? null : event.target.value)}
            />
          )}
        />
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" variant="outline" disabled={isSubmitting}>
          {isSubmitting ? ENHANCEMENT_COPY.saving : ENHANCEMENT_COPY.save}
        </Button>
      </div>
    </form>
  );
}
