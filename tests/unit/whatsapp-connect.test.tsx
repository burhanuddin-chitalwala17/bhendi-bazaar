/**
 * Connect WhatsApp's browser half (connect-whatsapp unit 1, D1): Meta's SDK loads only on the tap,
 * the pop-up's session-info message is believed only from Facebook, and the code and ids go back
 * with the attempt's state. What the server does with them is tests/integration/whatsapp-signup.test.ts.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const router = { refresh: vi.fn(), replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { channelsApiClient } from "@/components/channel/channelsApiClient";
import { WHATSAPP } from "@/components/channel/channel-copy";
import { readSessionInfo } from "@/components/channel/meta-sdk";
import { WhatsAppConnectButton } from "@/components/channel/whatsapp-connect-button";

const message = (data: unknown, origin = "https://www.facebook.com") => new MessageEvent("message", { data: typeof data === "string" ? data : JSON.stringify(data), origin });
const finish = (event = "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") => ({
  type: "WA_EMBEDDED_SIGNUP",
  event,
  data: { phone_number_id: "2001", waba_id: "1001" },
});

afterEach(() => {
  vi.restoreAllMocks();
  router.refresh.mockReset();
  router.replace.mockReset();
  delete window.FB;
});

describe("the pop-up's session-info message", () => {
  it("A3: is believed only from Facebook", () => {
    expect(readSessionInfo(message(finish()))).toEqual({ businessId: "1001", phoneId: "2001", kind: "coexistence" });
    expect(readSessionInfo(message(finish(), "https://web.facebook.com"))).not.toBeNull();
    expect(readSessionInfo(message(finish(), "https://facebook.com.evil.test"))).toBeNull();
    expect(readSessionInfo(message(finish(), "https://evilfacebook.com"))).toBeNull();
    expect(readSessionInfo(message(finish(), "null"))).toBeNull();
  });

  it("reads coexistence and a new number apart; a closed pop-up or an account with no number connects nothing", () => {
    expect(readSessionInfo(message(finish("FINISH")))).toMatchObject({ kind: "cloud" });
    expect(readSessionInfo(message({ type: "WA_EMBEDDED_SIGNUP", event: "CANCEL", data: {} }))).toBe("cancelled");
    expect(readSessionInfo(message({ type: "WA_EMBEDDED_SIGNUP", event: "FINISH_ONLY_WABA", data: { waba_id: "1" } }))).toBe("cancelled");
    expect(readSessionInfo(message({ type: "OTHER" }))).toBeNull();
    expect(readSessionInfo(message("not json"))).toBeNull();
  });
});

describe("Connect WhatsApp", () => {
  it("says what Meta will ask before it opens, and loads no SDK until tapped", () => {
    const append = vi.spyOn(document.body, "appendChild");
    render(<WhatsAppConnectButton orgId="org_1" />);
    expect(screen.getByText(WHATSAPP.beforeConsent)).toBeTruthy();
    expect(screen.getByRole("button", { name: WHATSAPP.connect })).toBeTruthy();
    expect(append.mock.calls.some(([node]) => node instanceof HTMLScriptElement)).toBe(false);
  });

  it("on tap: Opening Meta…, the SDK loads with the nonce, and the code and ids go back with the state (behaviour: Setting up)", async () => {
    vi.spyOn(channelsApiClient, "whatsappStart").mockResolvedValue({ state: "STATE", appId: "1000000002", configId: "1000000003" });
    const signup = vi.spyOn(channelsApiClient, "whatsappSignup").mockResolvedValue({ result: "connected" });
    let finishLogin: (code: string | null) => void = () => undefined;
    const login = vi.fn((callback: (r: { authResponse: { code: string } | null }) => void, _options: Record<string, unknown>) => {
      finishLogin = (code) => callback({ authResponse: code ? { code } : null });
    });
    render(<WhatsAppConnectButton orgId="org_1" nonce="NONCE" />);
    // Kept, not loaded: the test DOM refuses to fetch scripts.
    const appended: HTMLScriptElement[] = [];
    vi.spyOn(document.body, "appendChild").mockImplementation(<T extends Node>(node: T) => {
      appended.push(node as unknown as HTMLScriptElement);
      return node;
    });
    fireEvent.click(screen.getByRole("button", { name: WHATSAPP.connect }));
    expect(await screen.findByText(WHATSAPP.opening)).toBeTruthy();
    await waitFor(() => expect(appended).toHaveLength(1));
    const [script] = appended;
    expect(script.src).toBe("https://connect.facebook.net/en_US/sdk.js");
    expect(script.nonce).toBe("NONCE");
    act(() => {
      window.FB = { init: vi.fn(), login };
      window.fbAsyncInit?.();
    });
    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(login.mock.calls[0][1]).toMatchObject({ config_id: "1000000003", response_type: "code", extras: { featureType: "whatsapp_business_app_onboarding" } });
    expect(screen.getByText(WHATSAPP.finishInMeta)).toBeTruthy();

    act(() => {
      window.dispatchEvent(message(finish()));
      finishLogin("CODE");
    });
    await waitFor(() => expect(signup).toHaveBeenCalledWith({ state: "STATE", code: "CODE", businessId: "1001", phoneId: "2001", kind: "coexistence" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("a closed pop-up posts nothing and lands on the return note", async () => {
    vi.spyOn(channelsApiClient, "whatsappStart").mockResolvedValue({ state: "STATE", appId: "1000000002", configId: "1000000003" });
    const signup = vi.spyOn(channelsApiClient, "whatsappSignup");
    window.FB = { init: vi.fn(), login: (callback) => callback({ authResponse: null }) };
    render(<WhatsAppConnectButton orgId="org_1" />);
    fireEvent.click(screen.getByRole("button", { name: WHATSAPP.connect }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(expect.stringContaining("result=cancelled&channel=whatsapp")));
    expect(signup).not.toHaveBeenCalled();
  });

  it("WhatsApp not open yet: no SDK, straight to the return note", async () => {
    vi.spyOn(channelsApiClient, "whatsappStart").mockResolvedValue({ result: "unavailable" });
    render(<WhatsAppConnectButton orgId="org_1" />);
    const append = vi.spyOn(document.body, "appendChild");
    fireEvent.click(screen.getByRole("button", { name: WHATSAPP.connect }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(expect.stringContaining("result=unavailable")));
    expect(append).not.toHaveBeenCalled();
  });
});
