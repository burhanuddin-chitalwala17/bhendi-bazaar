"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useServerForm } from "@/hooks/core/useServerForm";
import { reportIssueSchema, type ReportIssueInput } from "@/lib/validation/schemas/requests.schema";
import { ISSUE_CATEGORY } from "@server/requests/request.types";

import { requestsApiClient } from "./requestsApiClient";
import { REQUESTS_COPY as C } from "./requests-copy";

/** The shop's report (setup-requests Q7, Q24): the category picked and the error attached when raised from one. */
export function useReportForm(orgId: string, seed: { productId: string | null; error: ReportIssueInput["error"] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useServerForm<ReportIssueInput>({
    schema: reportIssueSchema,
    defaultValues: { category: seed.error ? ISSUE_CATEGORY.LISTING : ISSUE_CATEGORY.OTHER, words: "", productId: seed.productId, error: seed.error },
    submit: (data) => requestsApiClient.report(orgId, data),
    successMessage: C.reported,
    fallbackMessage: C.reportFailed,
    onSuccess: () => {
      setOpen(false);
      form.reset();
      router.refresh();
    },
  });
  return { form, open, setOpen };
}
