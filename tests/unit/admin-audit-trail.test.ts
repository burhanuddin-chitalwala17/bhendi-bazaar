// The audit trail records that an admin action happened. It must never be what
// decides whether it happened — a dangling `AdminLog.adminId` once turned a created
// category and a deleted one into 409s, so the admin retried a write that had
// already succeeded. See docs/adr/0021-audit-trail-never-fails-the-action.md.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const create = vi.fn();
vi.mock("@server/shared/prisma", () => ({
  prisma: { adminLog: { create: (args: unknown) => create(args) } },
}));

const deleteCategory = vi.fn();
const getCategoryById = vi.fn();
vi.mock("@server/catalog/admin.category.repository", () => ({
  adminCategoryRepository: {
    getCategoryById: (id: string) => getCategoryById(id),
    deleteCategory: (id: string) => deleteCategory(id),
  },
}));
vi.mock("@server/catalog/category.repository", () => ({
  categoryRepository: { listTree: async () => [] },
}));

const { recordAdminAction, recordAdminActionIn } = await import(
  "@server/shared/audit/audit.service"
);
const { adminCategoryService } = await import(
  "@server/catalog/admin.category.service"
);

const entry = {
  adminId: "admin-1",
  action: "CATEGORY_DELETED",
  resource: "Category",
  resourceId: "cat-1",
};

const foreignKeyViolation = () =>
  Object.assign(new Error("Foreign key constraint violated"), { code: "P2003" });

beforeEach(() => {
  create.mockReset();
  deleteCategory.mockReset();
  getCategoryById.mockReset();
});

describe("recordAdminAction — after the mutation committed", () => {
  it("writes the entry", async () => {
    create.mockResolvedValue({});

    await recordAdminAction(entry);

    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].data).toMatchObject(entry);
  });

  it("swallows a failed write, because the action already happened", async () => {
    create.mockRejectedValue(foreignKeyViolation());
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(recordAdminAction(entry)).resolves.toBeUndefined();

    // Dropped, not lost: the entry reaches the platform logs so the action is
    // still recoverable.
    expect(logged).toHaveBeenCalledOnce();
    expect(logged.mock.calls[0][1]).toMatchObject({ entry });
    logged.mockRestore();
  });

  it("defaults metadata rather than writing null", async () => {
    create.mockResolvedValue({});

    await recordAdminAction(entry);

    expect(create.mock.calls[0][0].data.metadata).toEqual({});
  });

  it("does not join the admin back — the writer never reads the name", async () => {
    create.mockResolvedValue({});

    await recordAdminAction(entry);

    expect(create.mock.calls[0][0]).not.toHaveProperty("include");
  });
});

describe("recordAdminActionIn — inside the caller's transaction", () => {
  it("writes through the transaction client, not the global one", async () => {
    const txCreate = vi.fn().mockResolvedValue({});

    await recordAdminActionIn({ adminLog: { create: txCreate } } as never, entry);

    expect(txCreate).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
  });

  it("throws, so the mutation rolls back with it", async () => {
    // Swallowing here would only move the failure to COMMIT: the transaction is
    // already poisoned once a statement in it fails.
    const txCreate = vi.fn().mockRejectedValue(foreignKeyViolation());

    await expect(
      recordAdminActionIn({ adminLog: { create: txCreate } } as never, entry)
    ).rejects.toThrow("Foreign key constraint violated");
  });
});

describe("an admin mutation whose trail write fails", () => {
  it("still reports the delete as done — the row is already gone", async () => {
    // The bug this file exists for: the category was deleted, `adminLog.create`
    // hit the foreign key, and the handler answered 409. The admin then retried a
    // delete on a row that no longer existed.
    getCategoryById.mockResolvedValue({
      id: "cat-1",
      name: "Abayas",
      slug: "abayas",
      productsCount: 0,
    });
    deleteCategory.mockResolvedValue(undefined);
    create.mockRejectedValue(foreignKeyViolation());
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      adminCategoryService.deleteCategory("cat-1", "ghost-admin")
    ).resolves.toBeUndefined();

    expect(deleteCategory).toHaveBeenCalledWith("cat-1");
    logged.mockRestore();
  });

  it("still refuses a delete the domain rules reject", async () => {
    getCategoryById.mockResolvedValue({
      id: "cat-1",
      name: "Abayas",
      slug: "abayas",
      productsCount: 3,
    });

    await expect(
      adminCategoryService.deleteCategory("cat-1", "admin-1")
    ).rejects.toThrow(/3 products/);
    expect(deleteCategory).not.toHaveBeenCalled();
  });
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory()
      ? sources(path)
      : /\.ts$/.test(path)
        ? [path]
        : [];
  });
}

describe("the convention holds across every domain", () => {
  it("no service writes the trail directly — that is how the decision gets lost", () => {
    const offenders = sources("server")
      .filter((f) => !f.replace(/\\/g, "/").includes("audit/audit."))
      .filter((f) => readFileSync(f, "utf8").includes("adminLogRepository.createLog"));

    expect(offenders).toEqual([]);
  });
});
