/**
 * The gate on the review routes.
 *
 * The form only appears to a signed-in shopper and the sign-in panel opens before it,
 * but that is a courtesy to save a round trip. These 401s are the control, and they do
 * not care what the client believed about who was signed in — the reasoning the wishlist
 * route already carries, tested here because reviews publish immediately (R15) and an
 * anonymous write would be visible on an org's product page at once.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { value: null as { user: { id: string } } | null };
const service = {
  create: vi.fn(),
  edit: vi.fn(),
  remove: vi.fn(),
  getPage: vi.fn(),
};

vi.mock("next-auth", () => ({ getServerSession: async () => session.value }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));
vi.mock("@server/catalog/review.service", () => ({ reviewService: service }));
vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: async () => null,
  getRateLimitIdentifier: () => "test",
}));

const productRoute = await import("@/app/api/products/[id]/reviews/route");
const reviewRoute = await import("@/app/api/reviews/[id]/route");

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) =>
  new Request("http://localhost/api/products/p1/reviews", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  session.value = null;
  service.getPage.mockResolvedValue({
    reviews: [],
    summary: { average: 0, count: 0, histogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
    total: 0,
    hasMore: false,
  });
});

describe("POST /api/products/[id]/reviews", () => {
  it("refuses an anonymous caller", async () => {
    const response = await productRoute.POST(post({ rating: 5 }), params("p1"));
    expect(response.status).toBe(401);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("writes as the session's user, never as an id from the body", async () => {
    session.value = { user: { id: "buyer-1" } };
    service.create.mockResolvedValue({ id: "rev-1" });
    const response = await productRoute.POST(
      post({ rating: 5, userId: "someone-else" }),
      params("p1"),
    );
    expect(response.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith("buyer-1", "p1", {
      rating: 5,
      photos: [],
      video: null,
    });
  });

  it("refuses a body that is not a review", async () => {
    session.value = { user: { id: "buyer-1" } };
    const response = await productRoute.POST(post({ rating: 9 }), params("p1"));
    expect(response.status).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/products/[id]/reviews", () => {
  it("is open to anyone — reading reviews needs no account (R1)", async () => {
    const request = new Request(
      "http://localhost/api/products/p1/reviews?page=2",
    ) as never;
    const response = await productRoute.GET(request, params("p1"));
    expect(response.status).toBe(200);
    expect(service.getPage).toHaveBeenCalledWith("p1", 2, null);
  });

  it("treats a junk page as page one rather than an error", async () => {
    const request = new Request(
      "http://localhost/api/products/p1/reviews?page=banana",
    ) as never;
    const response = await productRoute.GET(request, params("p1"));
    expect(response.status).toBe(200);
    expect(service.getPage).toHaveBeenCalledWith("p1", 1, null);
  });
});

describe("PATCH and DELETE /api/reviews/[id]", () => {
  const patch = (body: unknown) =>
    new Request("http://localhost/api/reviews/rev-1", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }) as never;

  it("refuses an anonymous edit", async () => {
    const response = await reviewRoute.PATCH(patch({ rating: 1 }), params("rev-1"));
    expect(response.status).toBe(401);
    expect(service.edit).not.toHaveBeenCalled();
  });

  it("refuses an anonymous delete", async () => {
    const response = await reviewRoute.DELETE(
      new Request("http://localhost/api/reviews/rev-1", { method: "DELETE" }) as never,
      params("rev-1"),
    );
    expect(response.status).toBe(401);
    expect(service.remove).not.toHaveBeenCalled();
  });

  it("passes the session's user to the edit, so ownership is decided server-side", async () => {
    session.value = { user: { id: "buyer-1" } };
    const response = await reviewRoute.PATCH(patch({ rating: 2 }), params("rev-1"));
    expect(response.status).toBe(200);
    expect(service.edit).toHaveBeenCalledWith("rev-1", "buyer-1", {
      rating: 2,
      photos: [],
      video: null,
    });
  });

  it("passes the session's user to the delete", async () => {
    session.value = { user: { id: "buyer-1" } };
    const response = await reviewRoute.DELETE(
      new Request("http://localhost/api/reviews/rev-1", { method: "DELETE" }) as never,
      params("rev-1"),
    );
    expect(response.status).toBe(200);
    expect(service.remove).toHaveBeenCalledWith("rev-1", "buyer-1");
  });
});
