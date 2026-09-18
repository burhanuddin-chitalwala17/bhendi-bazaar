/**
 * The one auth sheet (seamless-sign-in D2–D4, D6–D8): opens on Sign in, switches views
 * in place, closes and refreshes on success, finishes the intent that opened it — and
 * forgets that intent if the shopper closes it instead.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { signIn, push, refresh, save, session } = vi.hoisted(() => ({
  signIn: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  save: vi.fn(),
  session: { status: "unauthenticated" as "unauthenticated" | "authenticated" | "loading" },
}));
vi.mock("next-auth/react", () => ({ signIn, useSession: () => ({ status: session.status }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/services/wishlistApiClient", () => ({ wishlistApiClient: { save, remove: vi.fn() } }));

import { AuthSheetProvider, useAuthSheet, type OpenAuthSheet } from "@/context/AuthSheetContext";
import { storeIntent } from "@/lib/auth-intent";

const SAVE_INTENT = { kind: "wishlist.save", productId: "prod-1" } as const;

function Opener(options: OpenAuthSheet) {
  const { open } = useAuthSheet();
  return (
    <button type="button" onClick={() => open(options)}>
      open
    </button>
  );
}

function renderSheet(options: OpenAuthSheet = {}) {
  render(
    <AuthSheetProvider>
      <Opener {...options} />
    </AuthSheetProvider>
  );
  fireEvent.click(screen.getByRole("button", { name: "open" }));
}

async function signInWith(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

const fetchMock = vi.fn();

beforeEach(() => {
  session.status = "unauthenticated";
  sessionStorage.clear();
  signIn.mockResolvedValue({ ok: true, error: null });
  save.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", fetchMock);
});

describe("the auth sheet", () => {
  it("opens on Sign in, saying what it is for", () => {
    renderSheet({ reason: "Sign in to save this" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Sign in to save this")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("switches views in place — the address bar never changes (R3)", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.getByLabelText("Name")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("closes and refreshes on success, staying on the page (R5, D3)", async () => {
    renderSheet();
    await signInWith("buyer@example.com", "secret");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("finishes the intent that opened it, before refreshing (R10, D6)", async () => {
    renderSheet({ intent: SAVE_INTENT });
    await signInWith("buyer@example.com", "secret");

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith("prod-1");
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]);
  });

  it("finishes it after a new account too (A4)", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    renderSheet({ intent: SAVE_INTENT });
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Buyer" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Str0ng!pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith("prod-1"));
  });

  it("closing abandons the intent — signing in later saves nothing (R11, A5)", async () => {
    render(
      <AuthSheetProvider>
        <Opener intent={SAVE_INTENT} />
      </AuthSheetProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "open" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Reopened the plain way, as the header's Login does.
    render(
      <AuthSheetProvider>
        <Opener />
      </AuthSheetProvider>
    );
    fireEvent.click(screen.getAllByRole("button", { name: "open" })[1]);
    await signInWith("buyer@example.com", "secret");

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(save).not.toHaveBeenCalled();
  });

  it("lands on Sign in with the email filled when sign-up's own sign-in fails (D4)", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    signIn.mockResolvedValue({ ok: false, error: "CredentialsSignin" });
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Buyer" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Str0ng!pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(screen.queryByLabelText("Name")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Email")).toHaveValue("new@example.com");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("the Google round trip (D7)", () => {
  it("stores the intent and returns to this page", () => {
    window.history.replaceState(null, "", "/product/cream-rida?size=M");
    renderSheet({ intent: SAVE_INTENT });

    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));

    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/product/cream-rida?size=M" });
    expect(JSON.parse(sessionStorage.getItem("bb-auth-intent") ?? "{}").intent).toEqual(SAVE_INTENT);
  });

  it("finishes the stored intent once the shopper comes back signed in (A3)", async () => {
    storeIntent(SAVE_INTENT);
    session.status = "authenticated";
    await act(async () => {
      render(<AuthSheetProvider>{null}</AuthSheetProvider>);
    });

    await waitFor(() => expect(save).toHaveBeenCalledWith("prod-1"));
    expect(sessionStorage.getItem("bb-auth-intent")).toBeNull();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("drops it when the shopper comes back signed out — the trip was cancelled", () => {
    storeIntent(SAVE_INTENT);
    render(<AuthSheetProvider>{null}</AuthSheetProvider>);
    expect(sessionStorage.getItem("bb-auth-intent")).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});
