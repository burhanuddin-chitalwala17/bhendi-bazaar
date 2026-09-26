/**
 * The worker card fails alone (dashboard-widgets R5, worker-foundation R5). Its first
 * deployment took the whole admin dashboard to a 500 because the preview environment had no
 * APP_ENV and the status lookup threw straight through the server component.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const workerStatus = vi.fn();
vi.mock("@server/shared/jobs", () => ({ workerStatus: (...a: unknown[]) => workerStatus(...a) }));
vi.mock("@/components/dashboard/redrive-failed-jobs-button", () => ({
  RedriveFailedJobsButton: ({ failed }: { failed: number }) => <button>redrive {failed}</button>,
}));

const { WorkerStatusCard } = await import("@/components/dashboard/worker-status-card");

beforeEach(() => vi.clearAllMocks());

describe("WorkerStatusCard", () => {
  it("renders the status when it can be read", async () => {
    workerStatus.mockResolvedValue({
      environment: "production", lastSeenAt: new Date(), version: "6d650f74483254a579c0694ab458e941b60b7c18", waiting: 2, active: 1, failed: 0, stale: false,
    });
    render(await WorkerStatusCard());
    expect(screen.getByText(/last seen just now/)).toBeInTheDocument();
    // A commit hash is shown short; the full forty characters belong in a log.
    expect(screen.getByText(/2 waiting · 1 running · 0 failed · 6d650f7$/)).toBeInTheDocument();
  });

  it("renders an unavailable card instead of throwing when the status cannot be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    workerStatus.mockRejectedValue(new Error("APP_ENV is not set"));
    render(await WorkerStatusCard());
    expect(screen.getByText(/Status unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/redrive/)).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("calls the worker stale when the status says so", async () => {
    workerStatus.mockResolvedValue({
      environment: "production", lastSeenAt: null, version: null, waiting: 0, active: 0, failed: 3, stale: true,
    });
    render(await WorkerStatusCard());
    expect(screen.getByText(/never seen/)).toBeInTheDocument();
    expect(screen.getByText(/redrive 3/)).toBeInTheDocument();
  });
});
