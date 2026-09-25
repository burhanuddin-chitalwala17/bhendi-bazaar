import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { workerStatus } from "@server/shared/jobs";
import { RedriveFailedJobsButton } from "./redrive-failed-jobs-button";

function ago(from: Date, now: Date): string {
  const minutes = Math.round((now.getTime() - from.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

/**
 * The worker's health, as a fact on a page (worker-foundation R5): when it was last seen,
 * what is waiting, what has failed. Red past the declared window, or if it has never beaten.
 */
export async function WorkerStatusCard() {
  const now = new Date();
  const status = await workerStatus(now);

  return (
    <Card className={status.stale ? "border-destructive/40" : undefined}>
      <CardContent className="flex flex-wrap items-center gap-4 pt-5">
        <Activity
          className={`h-8 w-8 shrink-0 ${status.stale ? "text-destructive" : "text-primary"}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            Worker{" "}
            <span className={status.stale ? "text-destructive" : "text-muted-foreground"}>
              {status.lastSeenAt ? `last seen ${ago(status.lastSeenAt, now)}` : "never seen"}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {status.waiting} waiting · {status.active} running · {status.failed} failed
            {status.version ? ` · ${status.version}` : ""}
          </p>
        </div>
        <RedriveFailedJobsButton failed={status.failed} />
      </CardContent>
    </Card>
  );
}
