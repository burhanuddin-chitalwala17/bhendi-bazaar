"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { workerJobsApiClient } from "@/components/dashboard/workerJobsApiClient";

function ago(iso: string, now: Date): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

const STATE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  created: "secondary",
  retry: "secondary",
  completed: "outline",
  failed: "destructive",
  cancelled: "destructive",
};

/**
 * The jobs behind the counts, on request (worker-foundation R5): a count says a job is stuck or
 * failed, the list says which one and why. Closed by default and fetched when opened, so the
 * dashboard stays a glance and pays nothing for it.
 */
export function WorkerJobsList() {
  const [open, setOpen] = useState(false);
  // Latches on the first open, so closing and reopening shows the jobs already read.
  const [requested, setRequested] = useState(false);
  const { data: jobs, loading, error, refetch } = useAsyncData(workerJobsApiClient.list, {
    enabled: requested,
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    // A first read that failed is retried on reopen, as it was before the hook.
    if (requested && jobs === null && !loading) void refetch();
    else setRequested(true);
  };

  const now = new Date();

  return (
    <div className="w-full">
      <Button type="button" variant="ghost" size="sm" onClick={toggle} aria-expanded={open} className="-ml-2">
        {open ? <ChevronUp className="mr-1 size-4" aria-hidden /> : <ChevronDown className="mr-1 size-4" aria-hidden />}
        {open ? "Hide jobs" : "Show recent jobs"}
      </Button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">The newest twenty, both queues.</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => void refetch()} disabled={loading} aria-label="Refresh jobs">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {jobs !== null && jobs.length === 0 && <p className="text-sm text-muted-foreground">No jobs yet.</p>}
          {jobs && jobs.length > 0 && (
            <ul className="divide-y divide-border text-sm">
              {jobs.map((job) => (
                <li key={job.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:gap-3">
                  <Badge variant={STATE_VARIANT[job.state] ?? "outline"} className="w-fit">
                    {job.state}
                  </Badge>
                  <span className="font-medium">{job.type}</span>
                  <span className="text-muted-foreground">
                    {job.completedAt
                      ? `finished ${ago(job.completedAt, now)}`
                      : job.startedAt
                        ? `started ${ago(job.startedAt, now)}`
                        : `queued ${ago(job.createdAt, now)}`}
                    {job.attempts > 0 ? ` · attempt ${job.attempts + 1}` : ""}
                    {job.queue !== "jobs" ? " · parked" : ""}
                  </span>
                  {job.error && <span className="truncate text-destructive sm:ml-auto sm:max-w-xs">{job.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
