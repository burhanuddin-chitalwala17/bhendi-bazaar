"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { readApiError } from "@/lib/api-error";

/** The one action on the worker card: put every parked job back on the queue. */
export function RedriveFailedJobsButton({ failed }: { failed: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function redrive() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/jobs/redrive", { method: "POST" });
      if (!response.ok) throw await readApiError(response);
      const { moved } = (await response.json()) as { moved: number };
      toast.success(moved === 1 ? "1 job re-queued" : `${moved} jobs re-queued`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not re-run the failed jobs");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={redrive} disabled={busy || failed === 0}>
      {busy ? "Re-queuing…" : "Re-run failed"}
    </Button>
  );
}
