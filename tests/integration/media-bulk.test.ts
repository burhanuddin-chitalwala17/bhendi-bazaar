/**
 * The library's bulk routes against a real schema (bulk-actions R3–R8, trd D1–D4): each runs the
 * one-asset rule per id and answers which ids went which way. Owns its fixtures.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { isDisposableDb, ensureFixtures, FIXTURE_KEYS } from "../helpers/test-db";

// The route's own branch is under test, not the portal guard (as in media-download.test.ts).
vi.mock("@/lib/org-auth", async () => {
  const { toErrorResponse } = await import("@/lib/api-error-response");
  return {
    withOrg:
      (handler: (request: Request, scope: object, params: { orgId: string }) => Promise<Response>) =>
      async (request: Request, context: { params: Promise<{ orgId: string }> }) => {
        const params = await context.params;
        try {
          return await handler(request, { orgId: params.orgId, role: "OWNER", userId: "media-bulk-test" }, params);
        } catch (error) {
          return toErrorResponse(error);
        }
      },
  };
});

type Kind = "IMAGE" | "VIDEO" | "VIDEO_EMBED";
type State = "READY" | "RETIRED" | "PENDING";

describe.skipIf(!isDisposableDb)("media bulk routes (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let routes: Record<"retire" | "tags" | "links", { POST: (r: NextRequest, c: { params: Promise<{ orgId: string }> }) => Promise<Response> }>;
  const stamp = `bulk-${Date.now().toString(36)}`;
  const prefix = `https://media.test/${stamp}/`;
  let orgId: string;
  let otherOrgId: string;

  const post = async (route: keyof typeof routes, body: unknown, as = orgId) => {
    const request = new NextRequest(`http://localhost/api/org/${as}/media/${route}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const response = await routes[route].POST(request, { params: Promise.resolve({ orgId: as }) });
    return { status: response.status, body: await response.json() };
  };

  const make = async (
    key: string,
    over: { kind?: Kind; state?: State; org?: string; objectKey?: string | null; bytes?: number | null; tags?: ("PRODUCT" | "REFERENCE")[]; derivedFromId?: string; transform?: object } = {},
  ) => {
    const kind = over.kind ?? "IMAGE";
    const row = await prisma.mediaAsset.create({
      data: {
        orgId: over.org ?? orgId,
        kind,
        state: over.state ?? "READY",
        ref: `${prefix}${key}`,
        objectKey: over.objectKey === undefined ? (kind === "VIDEO_EMBED" ? null : `org/${stamp}/${key}`) : over.objectKey,
        bytes: over.bytes === undefined ? 1000 : over.bytes,
        mimeType: kind === "IMAGE" ? "image/jpeg" : kind === "VIDEO" ? "video/mp4" : null,
        source: "UPLOAD",
        tags: over.tags ?? [],
        derivedFromId: over.derivedFromId,
        transform: over.transform,
      },
    });
    return row.id;
  };
  const stateOf = async (id: string) => (await prisma.mediaAsset.findUniqueOrThrow({ where: { id } })).state;
  const tagsOf = async (id: string) => (await prisma.mediaAsset.findUniqueOrThrow({ where: { id } })).tags;
  const useIn = (id: string) =>
    prisma.orgBanner.create({ data: { orgId, title: stamp, imageUrl: `${prefix}banner-${id}`, imageAssetId: id } });

  beforeAll(async () => {
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://images.example.test");
    vi.stubEnv("R2_ENDPOINT", "https://accountid.r2.cloudflarestorage.com");
    vi.stubEnv("R2_BUCKET", "bhendi-bazaar");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-key-id");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
    ({ prisma } = await import("@server/shared/prisma"));
    routes = {
      retire: await import("@/app/api/org/[orgId]/media/retire/route"),
      tags: await import("@/app/api/org/[orgId]/media/tags/route"),
      links: await import("@/app/api/org/[orgId]/media/download-links/route"),
    };
    ({ orgId, otherOrgId } = await ensureFixtures());
  });

  afterAll(async () => {
    await prisma.orgBanner.deleteMany({ where: { title: stamp } });
    // Renditions point at their source, so they go first.
    await prisma.mediaAsset.deleteMany({ where: { ref: { startsWith: prefix }, derivedFromId: { not: null } } });
    await prisma.mediaAsset.deleteMany({ where: { ref: { startsWith: prefix } } });
  });

  it("retires 5 with 2 used: 3 retired with their renditions, 2 in use (spec A4)", async () => {
    const ids = await Promise.all([1, 2, 3, 4, 5].map((n) => make(`retire-${n}`)));
    await useIn(ids[3]);
    await useIn(ids[4]);
    const rendition = await make("retire-1-rendition", { derivedFromId: ids[0], transform: { surface: "amazon-main" } });
    const crop = await make("retire-1-crop", { derivedFromId: ids[0], transform: { x: 0, y: 0, width: 1, height: 1 } });

    const { status, body } = await post("retire", { ids });
    expect(status).toBe(200);
    expect(body).toEqual({ retired: ids.slice(0, 3), inUse: ids.slice(3), alreadyRetired: [], notFound: [] });
    expect(await Promise.all(ids.map(stateOf))).toEqual(["RETIRED", "RETIRED", "RETIRED", "READY", "READY"]);
    expect(await stateOf(rendition)).toBe("RETIRED");
    expect(await stateOf(crop)).toBe("READY");

    const again = await post("retire", { ids: [ids[0], ids[3]] });
    expect(again.body).toEqual({ retired: [], inUse: [ids[3]], alreadyRetired: [ids[0]], notFound: [] });
  });

  it("another shop's id, an unknown id and a pending upload are not found and nothing changes (spec A6)", async () => {
    const theirs = await make("theirs", { org: otherOrgId });
    const pending = await make("pending", { state: "PENDING" });
    const retire = await post("retire", { ids: [theirs, `missing-${stamp}`, pending] });
    expect(retire.body).toEqual({ retired: [], inUse: [], alreadyRetired: [], notFound: [theirs, `missing-${stamp}`, pending] });
    expect(await stateOf(theirs)).toBe("READY");

    const tag = await post("tags", { ids: [theirs], tag: "REFERENCE", on: true });
    expect(tag.body).toEqual({ changed: [], notPhoto: [], retired: [], notFound: [theirs] });
    expect(await tagsOf(theirs)).toEqual([]);

    // Seen through another org's own scope, this org's photo is equally unknown.
    const mine = await make("mine-for-other");
    expect((await post("retire", { ids: [mine] }, otherOrgId)).body.notFound).toEqual([mine]);
    expect(await stateOf(mine)).toBe("READY");
  });

  it("tags the photos and leaves out videos, links and retired photos (spec A5)", async () => {
    const photos = await Promise.all([1, 2, 3, 4].map((n) => make(`tag-${n}`)));
    const video = await make("tag-video", { kind: "VIDEO" });
    const link = await make("tag-link", { kind: "VIDEO_EMBED" });
    const retired = await make("tag-retired", { state: "RETIRED" });

    const { status, body } = await post("tags", { ids: [...photos, video, link, retired], tag: "REFERENCE", on: true });
    expect(status).toBe(200);
    expect(body).toEqual({ changed: photos, notPhoto: [video, link], retired: [retired], notFound: [] });
    expect(await Promise.all(photos.map(tagsOf))).toEqual(photos.map(() => ["REFERENCE"]));
    expect(await tagsOf(video)).toEqual([]);
    expect(await tagsOf(retired)).toEqual([]);

    // Adding again tags once.
    await post("tags", { ids: photos, tag: "REFERENCE", on: true });
    expect(await tagsOf(photos[0])).toEqual(["REFERENCE"]);
  });

  it("addTag itself skips retired photos and other shops' photos, whoever calls it (trd D3)", async () => {
    const { mediaAssetRepository } = await import("@server/catalog/media-asset.repository");
    const retired = await make("addtag-retired", { state: "RETIRED" });
    const theirs = await make("addtag-theirs", { org: otherOrgId });
    const mine = await make("addtag-mine");
    await mediaAssetRepository.addTag([retired, theirs, mine], "REFERENCE", orgId);
    expect(await Promise.all([retired, theirs, mine].map(tagsOf))).toEqual([[], [], ["REFERENCE"]]);
  });

  it("add counts a photo retired between the read and the write as retired, not changed", async () => {
    const [kept, gone] = await Promise.all([make("addrace-kept"), make("addrace-gone")]);
    const findMany = prisma.mediaAsset.findMany.bind(prisma.mediaAsset);
    const spy = vi.spyOn(prisma.mediaAsset, "findMany").mockImplementationOnce((async (args: Parameters<typeof findMany>[0]) => {
      const seen = await findMany(args);
      await prisma.mediaAsset.update({ where: { id: gone }, data: { state: "RETIRED" } });
      return seen;
    }) as unknown as typeof prisma.mediaAsset.findMany);

    const { body } = await post("tags", { ids: [kept, gone], tag: "REFERENCE", on: true });
    spy.mockRestore();
    expect(body).toEqual({ changed: [kept], notPhoto: [], retired: [gone], notFound: [] });
    expect(await tagsOf(gone)).toEqual([]);
  });

  it("removes a tag by compare-and-set, keeping a tag another request added meanwhile", async () => {
    const photo = await make("untag", { tags: ["REFERENCE"] });
    const findFirst = prisma.mediaAsset.findFirst.bind(prisma.mediaAsset);
    const spy = vi.spyOn(prisma.mediaAsset, "findFirst").mockImplementationOnce((async (args: Parameters<typeof findFirst>[0]) => {
      const seen = await findFirst(args);
      await prisma.mediaAsset.update({ where: { id: photo }, data: { tags: { push: "PRODUCT" } } });
      return seen;
    }) as unknown as typeof prisma.mediaAsset.findFirst);

    const { body } = await post("tags", { ids: [photo], tag: "REFERENCE", on: false });
    spy.mockRestore();
    expect(body.changed).toEqual([photo]);
    expect(await tagsOf(photo)).toEqual(["PRODUCT"]);
  });

  it("signs own files for 15 minutes, names them as a single download does, and counts what has no file (spec A3)", async () => {
    const photos = await Promise.all([1, 2, 3].map((n) => make(`dl-${n}`, { bytes: n === 3 ? null : 2000 })));
    const link = await make("dl-link", { kind: "VIDEO_EMBED" });
    const swept = await make("dl-swept", { state: "RETIRED", objectKey: null });
    const theirs = await make("dl-theirs", { org: otherOrgId });

    const { status, body } = await post("links", { ids: [...photos, link, swept, theirs] });
    expect(status).toBe(200);
    expect(body.totalBytes).toBe(4000);
    expect(body.noFile).toEqual([
      { id: link, reason: "link" },
      { id: swept, reason: "deleted" },
    ]);
    expect(body.files.map((file: { id: string }) => file.id)).toEqual(photos);
    const [first] = body.files;
    expect(first).toMatchObject({ filename: `${FIXTURE_KEYS.orgCode}-${photos[0]}.jpg`, bytes: 2000 });
    const url = new URL(first.url);
    expect(url.pathname).toBe(`/bhendi-bazaar/org/${stamp}/dl-1`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(body.files[2].bytes).toBeNull();
  });

  it("refuses more than 500 MB with the totals in the envelope (spec A3, Q4)", async () => {
    const big = await Promise.all([1, 2].map((n) => make(`big-${n}`, { kind: "VIDEO", bytes: 300 * 1024 * 1024 })));
    const { status, body } = await post("links", { ids: big });
    expect(status).toBe(422);
    expect(body.details).toEqual([
      { path: "totalBytes", message: String(600 * 1024 * 1024) },
      { path: "limitBytes", message: String(500 * 1024 * 1024) },
    ]);

    // Exactly the limit is allowed.
    const edge = await make("big-edge", { kind: "VIDEO", bytes: 500 * 1024 * 1024 });
    expect((await post("links", { ids: [edge] })).status).toBe(200);
  });

  it("refuses 101 ids before touching anything (Q10)", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `x${i}`);
    expect((await post("retire", { ids })).status).toBe(400);
  });
});
