/**
 * Name, mobile and email on Shop details against the real schema and queue (org-profile U3; D7;
 * A3; Q21, Q23, Q25). Owns its fixtures: a migrated schema is all it needs.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OrgRole } from "@prisma/client";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";
import { JOBS_QUEUE, JOBS_SCHEMA } from "@server/shared/jobs/jobs.config";

describe.skipIf(!isDisposableDb)("shop contact (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let shopDetailsService: typeof import("@server/catalog/shop-details.service").shopDetailsService;
  let storefrontService: typeof import("@server/catalog/storefront.service").storefrontService;
  let adminOrgService: typeof import("@server/catalog/org.service").adminOrgService;
  const stamp = Date.now().toString(36);
  const handle = `contact-test-${stamp}`;
  let orgId: string;
  let userId: string;
  const owner = () => ({ userId, role: OrgRole.OWNER });

  const jobsFor = async () => {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->>'type' = 'org.email-changed' AND data->'payload'->>'orgId' = $2`,
      JOBS_QUEUE,
      orgId,
    );
    return Number(rows[0].n);
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ shopDetailsService } = await import("@server/catalog/shop-details.service"));
    ({ storefrontService } = await import("@server/catalog/storefront.service"));
    ({ adminOrgService } = await import("@server/catalog/org.service"));
    const { orgRepository } = await import("@server/catalog/org.repository");
    ({ userId } = await ensureFixtures());
    const org = await orgRepository.create({
      code: `CON-T${stamp}`.slice(0, 20),
      handle,
      name: `Contact Test ${stamp}`,
      email: `contact-${stamp}@example.invalid`,
      phone: "+919876543210",
      isActive: true,
    });
    orgId = org.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'orgId' = $2`,
      JOBS_QUEUE,
      orgId,
    );
    await prisma.adminLog.deleteMany({ where: { resourceId: orgId } });
    await prisma.org.delete({ where: { id: orgId } });
  });

  it("after a name and mobile change, the order-email contact and the brand page carry the new values (spec A3)", async () => {
    const before = await shopDetailsService.get(orgId);
    const renamed = await shopDetailsService.saveContact(orgId, owner(), {
      name: `Noor Attar ${stamp}`,
      expectedUpdatedAt: before.contactUpdatedAt,
    });
    await shopDetailsService.saveContact(orgId, owner(), { phone: "+919800000000", expectedUpdatedAt: renamed.contactUpdatedAt });
    expect(await adminOrgService.findEmailContact(orgId)).toMatchObject({ name: `Noor Attar ${stamp}` });
    expect((await storefrontService.brandPage(handle))?.name).toBe(`Noor Attar ${stamp}`);
    const after = await shopDetailsService.get(orgId);
    expect(after.phone).toBe("+919800000000");
    expect(after.email).toBe(`contact-${stamp}@example.invalid`);
    expect(after.handle).toBe(handle);
  });

  it("refuses staff and writes nothing (Q23)", async () => {
    const before = await shopDetailsService.get(orgId);
    await expect(
      shopDetailsService.saveContact(orgId, { userId, role: OrgRole.STAFF }, { name: "Taken Over", expectedUpdatedAt: before.contactUpdatedAt }),
    ).rejects.toMatchObject({ status: 403, message: "Only the shop owner can change this." });
    expect((await shopDetailsService.get(orgId)).name).toBe(before.name);
  });

  it("refuses a save carrying a version someone has since replaced (Q21)", async () => {
    const before = await shopDetailsService.get(orgId);
    await shopDetailsService.saveContact(orgId, owner(), { phone: "+919811111111", expectedUpdatedAt: before.contactUpdatedAt });
    await expect(
      shopDetailsService.saveContact(orgId, owner(), { phone: "+919822222222", expectedUpdatedAt: before.contactUpdatedAt }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await shopDetailsService.get(orgId)).phone).toBe("+919811111111");
  });

  it("audits a mobile change with the old and new number, and not a re-save of the same one (Q16)", async () => {
    const before = await shopDetailsService.get(orgId);
    const audited = () => prisma.adminLog.findMany({ where: { resourceId: orgId, action: "ORG_PHONE_CHANGED" }, orderBy: { createdAt: "desc" } });
    const count = (await audited()).length;
    const after = await shopDetailsService.saveContact(orgId, owner(), { phone: "+919844444444", expectedUpdatedAt: before.contactUpdatedAt });
    const logs = await audited();
    expect(logs).toHaveLength(count + 1);
    expect(logs[0].metadata).toMatchObject({ from: before.phone, to: "+919844444444" });
    await shopDetailsService.saveContact(orgId, owner(), { phone: "+919844444444", expectedUpdatedAt: after.contactUpdatedAt });
    expect(await audited()).toHaveLength(count + 1);
  });

  it("an email change enqueues exactly one notice to the old address, and audits it (Q25)", async () => {
    const before = await shopDetailsService.get(orgId);
    expect(await jobsFor()).toBe(0);
    const after = await shopDetailsService.saveContact(orgId, owner(), {
      email: `new-${stamp}@example.invalid`,
      expectedUpdatedAt: before.contactUpdatedAt,
    });
    expect(after.email).toBe(`new-${stamp}@example.invalid`);
    expect(await jobsFor()).toBe(1);
    const [job] = await prisma.$queryRawUnsafe<{ data: { payload: { oldEmail: string } } }[]>(
      `SELECT data FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'orgId' = $2`,
      JOBS_QUEUE,
      orgId,
    );
    expect(job.data.payload.oldEmail).toBe(`contact-${stamp}@example.invalid`);
    expect(await prisma.adminLog.count({ where: { resourceId: orgId, action: "ORG_EMAIL_CHANGED" } })).toBe(1);

    // Saving the same address again moves nothing worth telling anyone.
    await shopDetailsService.saveContact(orgId, owner(), { email: `new-${stamp}@example.invalid`, expectedUpdatedAt: after.contactUpdatedAt });
    expect(await jobsFor()).toBe(1);
  });

  it("a stale email change enqueues nothing (Q25: the notice exists only beside the change)", async () => {
    const before = await shopDetailsService.get(orgId);
    await shopDetailsService.saveContact(orgId, owner(), { phone: "+919833333333", expectedUpdatedAt: before.contactUpdatedAt });
    const queued = await jobsFor();
    await expect(
      shopDetailsService.saveContact(orgId, owner(), { email: `stale-${stamp}@example.invalid`, expectedUpdatedAt: before.contactUpdatedAt }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await jobsFor()).toBe(queued);
  });
});
