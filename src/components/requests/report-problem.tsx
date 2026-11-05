"use client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/forms/FormField";
import { HANDOFF_WIDE, HandoffSheet } from "@/components/shared/overlays/handoff-sheet";
import type { ReportIssueInput } from "@/lib/validation/schemas/requests.schema";
import { ISSUE_CATEGORIES } from "@server/requests/request.types";
import { CHANNEL_LABELS } from "@server/shared/channels";

import { REQUESTS_COPY as C } from "./requests-copy";
import { useReportForm } from "./useReportForm";

/**
 * "Report this" / "Report a problem" (setup-requests Q24, ux "Report a problem"): a bottom sheet on a
 * phone, a side panel on a desktop. Send is never disabled; empty words say why on tap.
 */
export function ReportProblem({
  orgId,
  productId = null,
  productName = null,
  error = null,
  label,
}: {
  orgId: string;
  productId?: string | null;
  productName?: string | null;
  error?: ReportIssueInput["error"];
  label: string;
}) {
  const { form, open, setOpen } = useReportForm(orgId, { productId, error });
  const words = form.watch("words") ?? "";
  const marketplace = error ? CHANNEL_LABELS[error.channel] : null;
  return (
    <HandoffSheet
      open={open}
      onOpenChange={setOpen}
      wide={HANDOFF_WIDE.SIDE}
      title={C.reportProblem}
      closeLabel={C.reportProblem}
      trigger={<Button variant="outline" size="sm" className="min-h-10">{label}</Button>}
    >
      <form onSubmit={form.onSubmit} className="flex flex-col gap-4">
        <FormField id="report-category" label={C.about} error={form.formState.errors.category?.message}>
          <Select id="report-category" {...form.register("category")}>
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{C.categories[c]}</option>
            ))}
          </Select>
        </FormField>
        <FormField
          id="report-words"
          label={C.whatHappened}
          error={form.formState.errors.words?.message}
          hint={words.length >= 900 ? C.wordsCounter(words.length, C.wordsMax) : C.wordsHint}
        >
          <Textarea id="report-words" rows={4} {...form.register("words")} />
        </FormField>
        {error && productName && marketplace && <p className="text-small text-muted-foreground">{C.sentWith(productName, marketplace)}</p>}
        {form.formError && <p className="text-small text-destructive">{form.formError}</p>}
        <Button type="submit" className="min-h-10 w-full" pending={form.isSubmitting}>{C.sendReport}</Button>
      </form>
    </HandoffSheet>
  );
}
