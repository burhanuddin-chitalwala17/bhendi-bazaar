"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { StatusBadge, type StatusTone } from "@/components/shared/badges/StatusBadge";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { workerJobsApiClient } from "@/components/dashboard/workerJobsApiClient";
import { DASHBOARD_COPY } from "./dashboard-copy";

function ago(iso: string, now: Date): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

const STATE_TONE: Record<string, StatusTone> = {
  active: "info",
  created: "neutral",
  retry: "warning",
  completed: "success",
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
        <Icon name={open ? "collapse" : "expand"} />
        {open ? DASHBOARD_COPY.hideJobs : DASHBOARD_COPY.showJobs}
      </Button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-caption text-muted-foreground">{DASHBOARD_COPY.jobsNote}</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => void refetch()} pending={loading}>
              <Icon name="refresh" />
              {DASHBOARD_COPY.refresh}
            </Button>
          </div>
          {error && <p className="text-small text-destructive">{error}</p>}
          {jobs !== null && jobs.length === 0 && <p className="text-small text-muted-foreground">{DASHBOARD_COPY.noJobs}</p>}
          {jobs && jobs.length > 0 && (
            <ul className="divide-y divide-border text-small">
              {jobs.map((job) => (
                <li key={job.id} className="flex flex-col gap-1 py-2 md:flex-row md:items-center md:gap-3">
                  <StatusBadge tone={STATE_TONE[job.state] ?? "neutral"} className="w-fit">
                    {job.state}
                  </StatusBadge>
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
                  {job.error && <span className="truncate text-destructive md:ml-auto md:max-w-xs">{job.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
