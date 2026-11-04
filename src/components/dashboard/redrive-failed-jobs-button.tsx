"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/core/useMutation";
import { workerJobsApiClient } from "@/components/dashboard/workerJobsApiClient";
import { DASHBOARD_COPY } from "./dashboard-copy";

/** The one action on the worker card: put every parked job back on the queue. */
export function RedriveFailedJobsButton({ failed }: { failed: number }) {
  const router = useRouter();
  // The hook toasts the failure; the success toast needs the count, so it is written here.
  const { mutate: redrive, isLoading: busy } = useMutation(workerJobsApiClient.redriveFailed, {
    onSuccess: ({ moved }) => {
      toast.success(moved === 1 ? "1 job re-queued" : `${moved} jobs re-queued`);
      router.refresh();
    },
  });

  return (
    <Button variant="outline" onClick={() => void redrive().catch(() => {})} disabled={busy || failed === 0}>
      {busy ? DASHBOARD_COPY.requeuing : DASHBOARD_COPY.rerunFailed}
    </Button>
  );
}
