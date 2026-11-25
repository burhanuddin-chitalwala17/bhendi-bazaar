/**
 * The library's download route against a real schema (viewer spec R5, R7; trd D1, D2): this org's
 * stored file redirects to a presigned GET, anything else is refused with the status the UI reads,
 * and HEAD answers the same status without redirecting. Owns its fixtures.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { isDisposableDb, ensureFixtures, FIXTURE_KEYS } from "../helpers/test-db";

// The route's own branch is under test, not the portal guard: the scope is handed straight in,
// and a refusal answers through the same envelope the real guard uses.
vi.mock("@/lib/org-auth", async () => {
  const { toErrorResponse } = await import("@/lib/api-error-response");
  return {
    withOrg:
      (handler: (request: Request, scope: object, params: { orgId: string }) => Promise<Response>) =>
      async (request: Request, context: { params: Promise<{ orgId: string }> }) => {
        const params = await context.params;
        try {
          return await handler(request, { orgId: params.orgId, role: "OWNER", userId: "media-download-test" }, params);
        } catch (error) {
          return toErrorResponse(error);
        }
      },
  };
});

describe.skipIf(!isDisposableDb)("media download route (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let copy: typeof import("@server/catalog/media-download");
  let route: typeof import("@/app/api/org/[orgId]/media/[assetId]/download/route");
  const stamp = Date.now().toString(36);
  let orgId: string;
  let otherOrgId: string;
  const ids: Record<string, string> = {};

  const call = async (method: "GET" | "HEAD", assetId: string, as = orgId) => {
    const request = new NextRequest(`http://localhost/api/org/${as}/media/${assetId}/download`, { method });
    const context = { params: Promise.resolve({ orgId: as, assetId }) };
    return method === "GET" ? route.GET(request, context) : route.HEAD(request, context);
  };

  beforeAll(async () => {
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://images.example.test");
    vi.stubEnv("R2_ENDPOINT", "https://accountid.r2.cloudflarestorage.com");
    vi.stubEnv("R2_BUCKET", "bhendi-bazaar");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-key-id");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
    ({ prisma } = await import("@server/shared/prisma"));
    copy = await import("@server/catalog/media-download");
    route = await import("@/app/api/org/[orgId]/media/[assetId]/download/route");
    ({ orgId, otherOrgId } = await ensureFixtures());

    const make = (key: string, data: { kind?: "IMAGE" | "VIDEO_EMBED"; state: "READY" | "PENDING" | "RETIRED"; objectKey: string | null }) =>
      prisma.mediaAsset
        .create({
          data: {
            orgId,
            kind: data.kind ?? "IMAGE",
            state: data.state,
            ref: `https://media.test/${stamp}/${key}`,
            objectKey: data.objectKey,
            source: "UPLOAD",
            mimeType: data.kind === "VIDEO_EMBED" ? null : "image/jpeg",
          },
        })
        .then((row) => (ids[key] = row.id));
    await Promise.all([
      make("ready", { state: "READY", objectKey: `org/${stamp}/ready.jpg` }),
      make("swept", { state: "RETIRED", objectKey: null }),
      make("kept", { state: "RETIRED", objectKey: `org/${stamp}/kept.jpg` }),
      make("pending", { state: "PENDING", objectKey: `org/${stamp}/pending.jpg` }),
      make("youtube", { kind: "VIDEO_EMBED", state: "READY", objectKey: null }),
    ]);
  });

  afterAll(async () => {
    await prisma.mediaAsset.deleteMany({ where: { ref: { startsWith: `https://media.test/${stamp}` } } });
  });

  it("redirects this org's file to a presigned GET named for the shop (spec A5)", async () => {
    const response = await call("GET", ids.ready);
    expect(response.status).toBe(302);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const target = new URL(response.headers.get("location")!);
    expect(target.host).toBe("accountid.r2.cloudflarestorage.com");
    expect(target.pathname).toBe(`/bhendi-bazaar/org/${stamp}/ready.jpg`);
    expect(target.searchParams.get("response-content-disposition")).toBe(
      `attachment; filename="${FIXTURE_KEYS.orgCode}-${ids.ready}.jpg"`
    );
  });

  it("serves a retired item while its file is kept (Q10)", async () => {
    expect((await call("GET", ids.kept)).status).toBe(302);
  });

  it("refuses another shop's member as not found (spec A7)", async () => {
    const response = await call("GET", ids.ready, otherOrgId);
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });

  it("refuses an id that is no asset, and a pending upload, as not found", async () => {
    expect((await call("GET", `missing-${stamp}`)).status).toBe(404);
    expect((await call("GET", ids.pending)).status).toBe(404);
  });

  it("answers 410 with the ux copy once a retired file is swept", async () => {
    const response = await call("GET", ids.swept);
    expect(response.status).toBe(410);
    expect((await response.json()).error).toBe(copy.DOWNLOAD_FILE_GONE);
  });

  it("answers 422 for a YouTube link, which has no file", async () => {
    const response = await call("GET", ids.youtube);
    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe(copy.DOWNLOAD_NO_FILE_FOR_YOUTUBE);
  });

  it("HEAD mirrors GET's status and never redirects (trd D5)", async () => {
    const statuses = await Promise.all(
      [ids.ready, ids.swept, ids.youtube, ids.pending].map(async (id) => (await call("HEAD", id)).status)
    );
    expect(statuses).toEqual([200, 410, 422, 404]);
    expect((await call("HEAD", ids.ready, otherOrgId)).status).toBe(404);
    expect((await call("HEAD", ids.ready)).headers.get("location")).toBeNull();
  });
});
