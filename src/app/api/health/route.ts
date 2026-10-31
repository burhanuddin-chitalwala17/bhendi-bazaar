// GET /api/health for the uptime monitor; ?deep=1 also checks the database and config (GTM B7).
import { NextResponse } from "next/server";
import { databaseReachable } from "@server/shared/health";
import { deployedCommit } from "@server/shared/deployment";
import { missingEnv } from "@/lib/env";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  if (!deep) return NextResponse.json({ status: "ok" }, { headers: NO_STORE });

  const database = await databaseReachable();
  // Says only that something is missing: the names are for the server log, not a public URL.
  const config = missingEnv().length === 0;
  const healthy = database && config;
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database: database ? "ok" : "unreachable",
      config: config ? "ok" : "incomplete",
      commit: deployedCommit(),
    },
    { status: healthy ? 200 : 503, headers: NO_STORE },
  );
}
