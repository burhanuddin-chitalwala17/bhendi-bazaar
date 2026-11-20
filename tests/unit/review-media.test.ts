/**
 * What a review may carry, and what it may not (review-media R1, R5a, R6, R12).
 *
 * The cap and the ownership test are the whole of this feature's exposure: reviewing
 * needs no purchase and reviews publish immediately, so the fields here are the only
 * thing between an arbitrary account and a picture on an org's product page.
 *
 * The case worth pinning hardest is a photograph that *is* in our bucket but is not the
 * author's. Bucket membership was once the whole test, which let a reviewer cite a
 * product's own image — hotlinking it onto their review, and then deleting it from the
 * store by editing it back out, because an edit removes the refs it drops. Both
 * directions are pinned below.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@server/shared/domain-error";

process.env.R2_PUBLIC_BASE_URL ??= "https://images.example.com";
const own = (name: string) => `${process.env.R2_PUBLIC_BASE_URL}/reviews/u1/${name}`;

const base = process.env.R2_PUBLIC_BASE_URL;
/** In our bucket, but not this author's: a product image, or another shopper's photo. */
const someoneElses = (path: string) => `${base}/${path}`;

const repository = {
  create: vi.fn(),
  updateOwn: vi.fn(),
  softDeleteOwn: vi.fn(),
  imageRefsFor: vi.fn(),
  getReviewById: vi.fn(),
};
const deleted: string[] = [];
const sized: string[] = [];
let sizingFails = false;

vi.mock("@server/catalog/review.repository", () => ({ reviewRepository: repository }));
vi.mock("@server/catalog/product.read.repository", () => ({
  productsRepository: { isOnSale: async () => true },
}));
vi.mock("@server/checkout/order.service", () => ({
  orderService: { hasPurchased: async () => new Set<string>() },
}));
vi.mock("@server/identity/profile.service", () => ({
  profileService: { getProfile: async () => ({ user: { name: "Fatima" } }) },
}));
vi.mock("@server/shared/audit/audit.service", () => ({
  recordAdminAction: vi.fn(),
  recordAdminActionIn: vi.fn(),
}));
vi.mock("@server/catalog/review-rating", () => ({
  loadRatingContext: async () => ({ byProduct: new Map() }),
  ratingFor: () => ({ average: 0, count: 0, histogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }),
  STAR_VALUES: [1, 2, 3, 4, 5],
}));
vi.mock("@server/catalog/object-store", async () => {
  const actual = await vi.importActual<typeof import("@server/catalog/object-store")>(
    "@server/catalog/object-store",
  );
  return {
    ...actual,
    deleteObject: async (url: string) => {
      deleted.push(url);
    },
    ensureWidthCopies: async (pathname: string) => {
      if (sizingFails) throw new Error("store down");
      sized.push(pathname);
      return true;
    },
  };
});

const { reviewService } = await import("@server/catalog/review.service");
const { reviewSubmissionSchema } = await import(
  "@/lib/validation/schemas/review.schema"
);
const { MAX_REVIEW_PHOTOS } = await import("@server/catalog/media");
const { DomainError } = await import("@server/shared/domain-error");

beforeEach(() => {
  vi.clearAllMocks();
  deleted.length = 0;
  sized.length = 0;
  sizingFails = false;
  repository.create.mockResolvedValue({
    id: "rev-1",
    userId: "u1",
    userName: "Fatima",
    rating: 5,
    title: null,
    comment: null,
    isVerified: false,
    createdAt: new Date("2026-09-20T00:00:00Z"),
    media: [],
  });
  repository.imageRefsFor.mockResolvedValue([]);
  repository.updateOwn.mockResolvedValue(1);
  repository.softDeleteOwn.mockResolvedValue(1);
});

describe("the submission schema", () => {
  it("accepts up to the cap and refuses one more", () => {
    const photos = (count: number) =>
      Array.from({ length: count }, (_, index) => own(`p${index}.webp`));
    expect(
      reviewSubmissionSchema.safeParse({ rating: 5, photos: photos(MAX_REVIEW_PHOTOS) })
        .success,
    ).toBe(true);
    expect(
      reviewSubmissionSchema.safeParse({
        rating: 5,
        photos: photos(MAX_REVIEW_PHOTOS + 1),
      }).success,
    ).toBe(false);
  });

  it("treats no photos as an empty set rather than undefined", () => {
    expect(reviewSubmissionSchema.parse({ rating: 5 }).photos).toEqual([]);
  });

  it("has no field for a video, of any kind (review-media R5a)", () => {
    const parsed = reviewSubmissionSchema.parse({
      rating: 5,
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoFile: "data:video/mp4;base64,AAAA",
    });
    expect(parsed).not.toHaveProperty("video");
    expect(parsed).not.toHaveProperty("videoFile");
  });

  it("accepts the same fields on a create and an edit", () => {
    const fields = Object.keys(
      reviewSubmissionSchema.parse({
        rating: 5,
        title: "t",
        comment: "c",
        photos: [own("a.webp")],
      }),
    ).sort();
    expect(fields).toEqual(["comment", "photos", "rating", "title"]);
  });
});

describe("what the service does with media", () => {
  it("stores photographs as IMAGE rows", async () => {
    await reviewService.create("u1", "p1", {
      rating: 5,
      photos: [own("a.webp"), own("b.webp")],
    });
    expect(repository.create.mock.calls[0][0].media).toEqual([
      { kind: "IMAGE", ref: own("a.webp") },
      { kind: "IMAGE", ref: own("b.webp") },
    ]);
  });

  it("writes each cited photograph's width copies, which the browser's PUT did not (ADR-0075)", async () => {
    await reviewService.create("u1", "p1", { rating: 5, photos: [own("a.webp"), own("b.webp")] });
    expect(sized).toHaveLength(2);
    expect(sized.every((pathname) => pathname.startsWith("reviews/u1/"))).toBe(true);
  });

  it("tells the reviewer to re-add a photo whose copies could not be made, and saves nothing", async () => {
    sizingFails = true;
    await expect(reviewService.create("u1", "p1", { rating: 5, photos: [own("a.webp")] })).rejects.toBeInstanceOf(DomainError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("refuses a photograph on a host that is not ours", async () => {
    await expect(
      reviewService.create("u1", "p1", {
        rating: 5,
        photos: ["https://not-ours.example.com/anything.jpg"],
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("refuses an object in our bucket that this author did not upload", async () => {
    // A product's own photograph, and another shopper's review photograph. Both are
    // "ours"; neither is theirs to cite.
    for (const ref of [
      someoneElses("products/prod-1/cover.webp"),
      someoneElses("reviews/u2/theirs.webp"),
    ]) {
      repository.create.mockClear();
      await expect(
        reviewService.create("u1", "p1", { rating: 5, photos: [ref] }),
      ).rejects.toBeInstanceOf(DomainError);
      expect(repository.create).not.toHaveBeenCalled();
    }
  });

  it("refuses a path that only looks like the author's folder", async () => {
    await expect(
      reviewService.create("u1", "p1", {
        rating: 5,
        photos: [someoneElses("reviews/u10/theirs.webp")],
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("refuses more photographs than the cap even if the schema was bypassed", async () => {
    await expect(
      reviewService.create("u1", "p1", {
        rating: 5,
        photos: Array.from({ length: MAX_REVIEW_PHOTOS + 1 }, (_, i) => own(`${i}.webp`)),
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("deletes only the files an edit dropped", async () => {
    repository.imageRefsFor.mockResolvedValue([own("keep.webp"), own("drop.webp")]);
    await reviewService.edit("rev-1", "u1", {
      rating: 4,
      photos: [own("keep.webp")],
    });
    expect(deleted).toEqual([own("drop.webp")]);
  });

  it("never deletes an object outside the author's own folder", async () => {
    // The guard that matters: even with a stored ref that should not be there, the
    // delete path refuses it rather than removing a product's photograph.
    repository.imageRefsFor.mockResolvedValue([
      someoneElses("products/prod-1/cover.webp"),
      own("drop.webp"),
    ]);
    await reviewService.edit("rev-1", "u1", { rating: 4, photos: [] });
    expect(deleted).toEqual([own("drop.webp")]);
  });

  it("keeps a review's files when its author retracts it (ADR-0032)", async () => {
    // The row is kept, so its media rows are kept, so nothing is unreferenced.
    repository.imageRefsFor.mockResolvedValue([own("a.webp"), own("b.webp")]);
    await reviewService.remove("rev-1", "u1");
    expect(deleted).toEqual([]);
  });

  it("refuses a retraction that was not theirs", async () => {
    repository.softDeleteOwn.mockResolvedValue(0);
    // Named, not bare: a bare `.toThrow()` is satisfied by a TypeError from the test's own
    // setup, so an authorisation hole and a typo would look the same.
    await expect(reviewService.remove("rev-1", "stranger")).rejects.toThrow(NotFoundError);
    expect(deleted).toEqual([]);
  });
});
