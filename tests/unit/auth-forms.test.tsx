/**
 * One form per flow, whoever hosts it (seamless-sign-in D1, R7, R8). The page and the
 * sheet are a heading plus the same component, so a failure reads the same in both
 * and what was typed survives it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { signIn, push, refresh } = vi.hoisted(() => ({
  signIn: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next-auth/react", () => ({ signIn, useSession: () => ({ status: "unauthenticated" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { SignInForm, SIGN_IN_FAILED } from "@/components/auth/sign-in-form";
import { AuthPageHost } from "@/components/auth/auth-page-host";
import { AuthSheet } from "@/components/auth/auth-sheet";

beforeEach(() => {
  signIn.mockResolvedValue({ ok: true, error: null });
});

async function signInWith(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("SignInForm", () => {
  it("signs in without leaving the page, then hands over to the host", async () => {
    const onSuccess = vi.fn();
    render(<SignInForm onSuccess={onSuccess} onSwitchView={vi.fn()} googleCallbackUrl="/" />);

    await signInWith("buyer@example.com", "secret");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith("credentials", {
      redirect: false,
      email: "buyer@example.com",
      password: "secret",
    });
  });

  it("shows a failure in the form and keeps what was typed (R7)", async () => {
    signIn.mockResolvedValue({ ok: false, error: "CredentialsSignin" });
    const onSuccess = vi.fn();
    render(<SignInForm onSuccess={onSuccess} onSwitchView={vi.fn()} googleCallbackUrl="/" />);

    await signInWith("buyer@example.com", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent(SIGN_IN_FAILED);
    expect(screen.getByLabelText("Email")).toHaveValue("buyer@example.com");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("asks the host for another view instead of linking to a page", () => {
    const onSwitchView = vi.fn();
    render(<SignInForm onSuccess={vi.fn()} onSwitchView={onSwitchView} googleCallbackUrl="/" />);

    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(onSwitchView).toHaveBeenCalledWith("signup");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("page and panel are the same form (R8, A7)", () => {
  it("a wrong password reads the same on the page and in the sheet", async () => {
    signIn.mockResolvedValue({ ok: false, error: "CredentialsSignin" });

    const page = render(<AuthPageHost view="signin" callbackUrl="/" />);
    await signInWith("buyer@example.com", "wrong");
    const pageMessage = (await screen.findByRole("alert")).textContent;
    page.unmount();

    render(
      <AuthSheet
        open
        onOpenChange={vi.fn()}
        view="signin"
        onSwitchView={vi.fn()}
        onSuccess={vi.fn()}
        onBeforeGoogle={vi.fn()}
      />
    );
    await signInWith("buyer@example.com", "wrong");
    const sheetMessage = (await screen.findByRole("alert")).textContent;

    expect(sheetMessage).toBe(pageMessage);
  });

  it("the page returns the shopper to their callbackUrl, not the home page (R17)", async () => {
    render(<AuthPageHost view="signin" callbackUrl="/admin" />);
    await signInWith("admin@example.com", "secret");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
  });

  it("the page carries callbackUrl to the next view", () => {
    render(<AuthPageHost view="signin" callbackUrl="/wishlist" />);
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(push).toHaveBeenCalledWith("/signup?callbackUrl=%2Fwishlist");
  });

  it("no host holds a field, a schema or a submit of its own (D1)", () => {
    const hosts = [
      "src/app/(auth)/signin/page.tsx",
      "src/app/(auth)/signup/page.tsx",
      "src/app/(auth)/forgot-password/page.tsx",
      "src/components/auth/auth-page-host.tsx",
      "src/components/auth/auth-sheet.tsx",
    ];
    for (const file of hosts) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/useServerForm|register\(|Schema\b|<Input\b|<form\b/);
    }
  });
});
