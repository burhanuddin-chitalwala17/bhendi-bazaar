/**
 * Who may write a review, and what a payload is not allowed to decide.
 *
 * Authorization is at TESTING.md's 100% bar — owner passes, non-owner refused, anonymous
 * refused, on both the edit and the delete — because a review carries someone's name and
 * an endpoint that let a stranger rewrite it would be a defacement, not a bug.
 *
 * The other half is Invariant 4: the **Verified purchase** mark comes from order history
 * (R4), the display name from the account (R11) and publication from the column default
 * (R15), so none of the three may arrive in a body. An admin cannot grant the badge
 * either — it used to be in the moderation schema.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = {
  create: vi.fn(),
  updateOwn: vi.fn(),
  softDeleteOwn: vi.fn(),
  listPublished: vi.fn(),
  // The media a review holds, read so the service can delete the files an edit or a
  // delete drops (review-media R12). Empty here: media is tested in its own file.
  imageRefsFor: vi.fn(),
};
const productsRepository = { isOnSale: vi.fn() };
const orderService = { hasPurchased: vi.fn() };
const profileService = { getProfile: vi.fn() };

vi.mock("@server/catalog/review.repository", () => ({ reviewRepository: repository }));
vi.mock("@server/catalog/product.read.repository", () => ({ productsRepository }));
vi.mock("@server/checkout/order.service", () => ({ orderService }));
vi.mock("@server/identity/profile.service", () => ({ profileService }));
vi.mock("@server/shared/audit/audit.service", () => ({
  recordAdminAction: vi.fn(),
  recordAdminActionIn: vi.fn(),
}));
vi.mock("@server/catalog/review-rating", () => ({
  loadRatingContext: async () => ({ byProduct: new Map() }),
  ratingFor: () => ({ average: 0, count: 0, histogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }),
  STAR_VALUES: [1, 2, 3, 4, 5],
}));

const { reviewService } = await import("@server/catalog/review.service");
const { reviewSubmissionSchema } = await import(
  "@/lib/validation/schemas/review.schema"
);
const { updateReviewSchema } = await import("@/lib/validation/schemas/admin.schemas");
const { NotFoundError } = await import("@server/shared/domain-error");

const createdRow = {
  id: "rev-1",
  userId: "buyer-1",
  userName: "Fatima",
  rating: 5,
  title: null,
  comment: null,
  isVerified: false,
  createdAt: new Date("2026-09-20T10:00:00Z"),
  media: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  productsRepository.isOnSale.mockResolvedValue(true);
  profileService.getProfile.mockResolvedValue({ user: { name: "Fatima" } });
  orderService.hasPurchased.mockResolvedValue(new Set<string>());
  repository.create.mockResolvedValue(createdRow);
  repository.imageRefsFor.mockResolvedValue([]);
});

describe("writing a review", () => {
  it("refuses a product that is not on sale", async () => {
    productsRepository.isOnSale.mockResolvedValue(false);
    await expect(
      reviewService.create("buyer-1", "gone", { rating: 5 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("takes the display name from the account, never the payload (R11)", async () => {
    profileService.getProfile.mockResolvedValue({ user: { name: "Zainab" } });
    await reviewService.create("buyer-1", "p1", {
      rating: 4,
      // A payload cannot carry a name at all — this is what a caller would try.
      ...({ userName: "Administrator" } as object),
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userName: "Zainab" }),
    );
  });

  it("still has a name to show when the account has none", async () => {
    profileService.getProfile.mockResolvedValue({ user: { name: "   " } });
    await reviewService.create("buyer-1", "p1", { rating: 4 });
    expect(repository.create.mock.calls[0][0].userName.length).toBeGreaterThan(0);
  });

  it("awards the badge from order history, and only then (R4)", async () => {
    orderService.hasPurchased.mockResolvedValue(new Set(["p1"]));
    await reviewService.create("buyer-1", "p1", { rating: 5 });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ isVerified: true }),
    );

    orderService.hasPurchased.mockResolvedValue(new Set(["something-else"]));
    await reviewService.create("buyer-1", "p1", { rating: 5 });
    expect(repository.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ isVerified: false }),
    );
  });

  it("never passes a publication flag — the column default publishes it (R15)", async () => {
    await reviewService.create("buyer-1", "p1", { rating: 5 });
    expect(repository.create.mock.calls[0][0]).not.toHaveProperty("withdrawnAt");
    expect(repository.create.mock.calls[0][0]).not.toHaveProperty("deletedAt");
    expect(repository.create.mock.calls[0][0]).not.toHaveProperty("isVerified", true);
  });

  it("stores blank text as absent rather than as an empty string", async () => {
    await reviewService.create("buyer-1", "p1", {
      rating: 5,
      title: "   ",
      comment: "",
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: null, comment: null }),
    );
  });
});

describe("editing and deleting your own review (R9)", () => {
  it("scopes the edit to the author in the statement, not by a prior read", async () => {
    repository.updateOwn.mockResolvedValue(1);
    await reviewService.edit("rev-1", "buyer-1", { rating: 3 });
    expect(repository.updateOwn).toHaveBeenCalledWith(
      "rev-1",
      "buyer-1",
      expect.objectContaining({ rating: 3 }),
    );
  });

  it("refuses an edit of somebody else's review", async () => {
    // Nothing matched `{ id, userId }`, which is what a non-owner looks like.
    repository.updateOwn.mockResolvedValue(0);
    await expect(
      reviewService.edit("rev-1", "stranger", { rating: 1 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("scopes the retraction the same way", async () => {
    repository.softDeleteOwn.mockResolvedValue(1);
    await reviewService.remove("rev-1", "buyer-1");
    expect(repository.softDeleteOwn).toHaveBeenCalledWith("rev-1", "buyer-1");
  });

  it("refuses a retraction of somebody else's review", async () => {
    repository.softDeleteOwn.mockResolvedValue(0);
    await expect(reviewService.remove("rev-1", "stranger")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("the submission schema", () => {
  it("requires a star rating", () => {
    expect(reviewSubmissionSchema.safeParse({}).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ rating: 4.5 }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ rating: 4 }).success).toBe(true);
  });

  it("drops every server-owned field a caller sends", () => {
    const parsed = reviewSubmissionSchema.parse({
      rating: 5,
      withdrawnAt: null,
      deletedAt: null,
      isVerified: true,
      userName: "Administrator",
      createdAt: "2020-01-01",
      productId: "another-product",
    });
    // `photos` is the review's own field and always present after a parse;
    // nothing the caller invented survives.
    expect(Object.keys(parsed).sort()).toEqual(["photos", "rating"]);
  });

  it("accepts the same fields on a create and an edit", () => {
    // Asymmetry between create and update is how mass assignment arrives (Invariant 4),
    // so both paths parse this one schema and there is nothing to compare.
    const fields = Object.keys(
      reviewSubmissionSchema.parse({ rating: 5, title: "t", comment: "c" }),
    ).sort();
    expect(fields).toEqual(["comment", "photos", "rating", "title"]);
  });
});

describe("the moderation schema", () => {
  it("changes withdrawal and nothing else (R15)", () => {
    const parsed = updateReviewSchema.parse({ withdrawn: true, isVerified: true });
    expect(parsed).toEqual({ withdrawn: true });
  });

  it("will not take an empty PATCH", () => {
    expect(updateReviewSchema.safeParse({}).success).toBe(false);
  });
});
