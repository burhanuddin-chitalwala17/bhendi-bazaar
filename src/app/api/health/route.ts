/**
 * GET /api/health: the uptime monitor's probe (docs/GTM-READINESS.md B7).
 *
 * Plain: is this deployment serving? Answers without touching the database, so a monitor can
 * ping it as often as it likes. `?deep=1`: can it also reach the database? At most one query
 * per 30 s, and 503 when it cannot, so the monitor alerts.
 */
import { NextResponse } from "next/server";
import { databaseReachable } from "@server/shared/health";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;

  if (!deep) return NextResponse.json({ status: "ok", commit }, { headers: NO_STORE });

  const database = await databaseReachable();
  return NextResponse.json(
    { status: database ? "ok" : "degraded", commit, database: database ? "ok" : "unreachable" },
    { status: database ? 200 : 503, headers: NO_STORE },
  );
}
