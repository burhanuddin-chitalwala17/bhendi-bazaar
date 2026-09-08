/**
 * The heart, and the rule that there is no guest wishlist.
 *
 * A signed-out visitor is told to sign in and nothing is stored — no localStorage, no
 * anonymous row, so no sign-in merge to get wrong later. For everyone else the heart
 * fills under the finger and only reverts if the write actually failed.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WishlistProvider } from "@/context/WishlistContext";
import { WishlistButton } from "@/components/wishlist/wishlist-button";

// Hoisted so `vi.mock`'s own hoisting still finds it: sonner's `toast` is a callable
// with methods hung off it, so the mock has to be a function, not an object.
const { toast } = vi.hoisted(() => {
  const fn = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return { toast: fn };
});
vi.mock("sonner", () => ({ toast }));

let authStatus: "guest" | "authenticated" | "loading" = "authenticated";
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ status: authStatus, user: null }),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  authStatus = "authenticated";
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  vi.stubGlobal("fetch", fetchMock);
});

const renderHeart = (saved: string[] = [], productId = "prod-1") =>
  render(
    <WishlistProvider initialProductIds={saved}>
      <WishlistButton productId={productId} />
    </WishlistProvider>
  );

describe("the heart, signed out", () => {
  it("asks the visitor to sign in and stores nothing", async () => {
    authStatus = "guest";
    renderHeart();

    fireEvent.click(screen.getByRole("button", { name: "Add to wishlist" }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith("Sign in to add to wishlist"));
    expect(fetchMock).not.toHaveBeenCalled();
    // Still hollow: nothing was saved, so nothing may look saved.
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });
});

describe("the heart, session still loading", () => {
  it("does not tell a possibly-signed-in user to sign in — the route's 401 decides", async () => {
    authStatus = "loading";
    renderHeart();

    fireEvent.click(screen.getByRole("button", { name: "Add to wishlist" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(toast).not.toHaveBeenCalledWith("Sign in to add to wishlist");
  });
});

describe("the heart, signed in", () => {
  it("paints saved products filled on the first render, with no fetch to find out", () => {
    renderHeart(["prod-1"]);
    expect(screen.getByRole("button", { name: "Remove from wishlist" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fills immediately and saves in the background", async () => {
    renderHeart();
    fireEvent.click(screen.getByRole("button", { name: "Add to wishlist" }));

    // Optimistic: filled before the request resolves.
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/wishlist",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ productId: "prod-1" }) })
      )
    );
  });

  it("confirms the save with a toast, once the write has actually landed", async () => {
    renderHeart();
    fireEvent.click(screen.getByRole("button", { name: "Add to wishlist" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Added to wishlist"));
  });

  it("stays quiet on removal — the emptying heart is the feedback", async () => {
    renderHeart(["prod-1"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove from wishlist" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("removes only on an explicit un-heart, naming the product", async () => {
    renderHeart(["prod-1"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove from wishlist" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/wishlist?productId=prod-1",
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("reverts the heart when the write fails, rather than lying about what is saved", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Could not add that to your wishlist" }),
    });
    renderHeart();

    fireEvent.click(screen.getByRole("button", { name: "Add to wishlist" }));

    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false")
    );
    expect(toast.error).toHaveBeenCalledWith("Could not add that to your wishlist");
    // Never both: a failed write must not also report success.
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("keeps two hearts for one product in step — a grid tile and the rail below it", async () => {
    render(
      <WishlistProvider initialProductIds={[]}>
        <WishlistButton productId="prod-1" />
        <WishlistButton productId="prod-1" />
      </WishlistProvider>
    );

    fireEvent.click(screen.getAllByRole("button")[0]);

    await waitFor(() =>
      screen.getAllByRole("button").forEach((heart) =>
        expect(heart).toHaveAttribute("aria-pressed", "true")
      )
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
