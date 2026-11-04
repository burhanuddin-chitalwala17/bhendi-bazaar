import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { workerStatus, type WorkerStatus } from "@server/shared/jobs";
import { RedriveFailedJobsButton } from "./redrive-failed-jobs-button";
import { WorkerJobsList } from "./worker-jobs-list";
import { DASHBOARD_COPY } from "./dashboard-copy";

/** A commit hash reads as seven characters; anything else, a tag or "dev", is shown whole. */
function shortVersion(version: string): string {
  return /^[0-9a-f]{40}$/.test(version) ? version.slice(0, 7) : version;
}

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
 *
 * Like every dashboard widget, it fails alone (dashboard-widgets R5): a status that cannot be
 * read — a deployment missing `APP_ENV`, a database hiccup — renders as an unavailable card,
 * never as a dead dashboard. This shipped once as a 500 on the whole admin page.
 */
export async function WorkerStatusCard() {
  const now = new Date();
  let status: WorkerStatus;
  try {
    status = await workerStatus(now);
  } catch (error) {
    console.error("[WorkerStatusCard] status unavailable:", error);
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-center gap-4 pt-5">
          <Icon name="warning" size="lg" tone="destructive" />
          <div className="min-w-0">
            <p className="text-small font-medium text-foreground">{DASHBOARD_COPY.worker}</p>
            <p className="text-small text-destructive">
              {DASHBOARD_COPY.workerUnavailable}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={status.stale ? "border-destructive/40" : undefined}>
      <CardContent className="flex flex-wrap items-center gap-4 pt-5">
        <Icon name="activity" size="lg" tone={status.stale ? "destructive" : "primary"} />
        <div className="min-w-0 flex-1">
          <p className="text-small font-medium text-foreground">
            Worker{" "}
            <span className={status.stale ? "text-destructive" : "text-muted-foreground"}>
              {status.lastSeenAt ? `last seen ${ago(status.lastSeenAt, now)}` : "never seen"}
            </span>
          </p>
          <p className="text-small text-muted-foreground">
            {status.waiting} waiting · {status.active} running · {status.failed} failed ·{" "}
            {status.completedDay} done in 24h
            {status.version ? ` · ${shortVersion(status.version)}` : ""}
          </p>
        </div>
        <RedriveFailedJobsButton failed={status.failed} />
        <WorkerJobsList />
      </CardContent>
    </Card>
  );
}
