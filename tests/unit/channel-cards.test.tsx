/**
 * Every state of the marketplace card reads as ux.md wrote it, and offers its one action (spec A4).
 * Buttons that cannot do their job still answer on tap rather than greying out (ADR-0053).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { MarketplaceCard } from "@/components/channel/marketplace-card";
import { ChannelAttentionBanner } from "@/components/channel/channel-attention-banner";
import { RESULT_NOTE } from "@/components/channel/channel-copy";
import { orgChannelsSchema } from "@/lib/validation/schemas/org-channels.schema";
import { CARD_STATE, CONNECT_RESULT, type ChannelCardDTO } from "@server/channels/channel-connection.types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const base: ChannelCardDTO = {
  channel: "amazon",
  label: "Amazon",
  state: CARD_STATE.NOT_CONNECTED,
  connectedBy: null,
  connectedAt: null,
  disconnectedBy: null,
  disconnectedAt: null,
  lastCheckedAt: null,
  stale: false,
  read: null,
  listings: null,
  reapproveBy: null,
  reason: null,
  stockSync: null,
};
const card = (over: Partial<ChannelCardDTO>) => render(<MarketplaceCard orgId="org_1" card={{ ...base, ...over }} />);
const NOW = new Date().toISOString();

describe("the marketplace card (spec A4)", () => {
  it("not connected: the pitch, and Connect as a link to the connect route", () => {
    card({});
    expect(screen.getByText("List, update stock and get orders from your Amazon seller account.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect Amazon" })).toHaveAttribute("href", "/api/org/org_1/channels/amazon/connect");
  });

  it("connected: who and when, last checked, re-approval date, and Disconnect", () => {
    card({ state: CARD_STATE.CONNECTED, connectedBy: "Farida", connectedAt: NOW, lastCheckedAt: NOW, reapproveBy: "2027-10-20T00:00:00.000Z" });
    expect(screen.getByText("● Connected")).toBeInTheDocument();
    expect(screen.getByText(/^Connected by Farida · /)).toBeInTheDocument();
    expect(screen.getByText(/Last checked just now · Re-approve by/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeEnabled();
  });

  it("renewal due: the chip names the date and Renew now reconnects", () => {
    card({ state: CARD_STATE.RENEWAL_DUE, connectedAt: NOW, lastCheckedAt: NOW, reapproveBy: "2026-11-12T00:00:00.000Z" });
    expect(screen.getByText(/^Renew by 12 Nov/)).toBeInTheDocument();
    expect(screen.getByText("Amazon asks sellers to re-approve apps once a year. It takes one tap; nothing is lost.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Renew now" })).toBeInTheDocument();
  });

  it.each([
    ["rejected", "Amazon stopped accepting our access."],
    ["expired", "Amazon's approval expired."],
    ["revoked", "Access was removed from Seller Central."],
  ] as const)("needs reconnecting (%s): says why, and offers Reconnect", (reason, text) => {
    card({ state: CARD_STATE.NEEDS_RECONNECT, reason });
    expect(screen.getByText("Needs reconnecting")).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reconnect" })).toBeInTheDocument();
  });

  it("disconnected before: who and when, and Connect again", () => {
    card({ disconnectedBy: "Farida", disconnectedAt: "2026-10-18T10:00:00.000Z" });
    expect(screen.getByText(/^Disconnected by Farida · 18 Oct 2026\.$/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect Amazon" })).toBeInTheDocument();
  });

  it("unavailable: Coming soon, and Tell me more still answers (never disabled)", () => {
    card({ channel: "flipkart", label: "Flipkart", state: CARD_STATE.UNAVAILABLE });
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.getByText("Connecting Flipkart isn't open yet. We'll show it here when it is.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tell me more" })).toBeEnabled();
  });

  it("full: explains Amazon's 25-shop limit", () => {
    card({ state: CARD_STATE.FULL });
    expect(screen.getByText("Full for now")).toBeInTheDocument();
    expect(screen.getByText(/allows 25 shops until it approves our app listing/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Why?" })).toBeEnabled();
  });

  it("stale: last contact in warning colour, with Check now", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    card({ state: CARD_STATE.CONNECTED, connectedAt: threeDaysAgo, lastCheckedAt: threeDaysAgo, stale: true });
    expect(screen.getByText("Last checked 3 days ago")).toHaveClass("text-warning");
    expect(screen.getByRole("button", { name: "Check now" })).toBeEnabled();
  });
});

describe("switching accounts is disconnect, then connect (Q8)", () => {
  it.each([CARD_STATE.RENEWAL_DUE, CARD_STATE.NEEDS_RECONNECT])("%s offers Disconnect beside its primary action", (state) => {
    card({ state, connectedAt: NOW, lastCheckedAt: NOW, reapproveBy: "2026-11-12T00:00:00.000Z", reason: "revoked" });
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeEnabled();
  });
});

describe("a marketplace is on only by connecting it (D11)", () => {
  it("the tap-to-turn-on schema accepts Google and Meta and refuses Amazon and Flipkart", () => {
    expect(orgChannelsSchema.safeParse({ channels: [{ channel: "google", enabled: true }] }).success).toBe(true);
    expect(orgChannelsSchema.safeParse({ channels: [{ channel: "amazon", enabled: true }] }).success).toBe(false);
    expect(orgChannelsSchema.safeParse({ channels: [{ channel: "flipkart", enabled: true }] }).success).toBe(false);
  });
});

describe("the return note", () => {
  it("has ux.md's copy for every outcome the callback can produce", () => {
    for (const result of Object.values(CONNECT_RESULT)) {
      expect(RESULT_NOTE[result].text("Amazon").length).toBeGreaterThan(0);
    }
    expect(RESULT_NOTE.other_shop.text("Amazon")).toBe(
      "This Amazon account is already connected to another shop. An account can belong to one shop only; disconnect it there first.",
    );
  });
});

describe("the dashboard banner (spec R9)", () => {
  it("shows nothing when no connection needs the shop", () => {
    const { container } = render(<ChannelAttentionBanner orgId="org_1" attention={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names one problem with its fix, and summarises two", () => {
    const { rerender } = render(
      <ChannelAttentionBanner orgId="org_1" attention={[{ channel: "flipkart", label: "Flipkart", state: "needs_reconnect", reapproveBy: null }]} />,
    );
    expect(screen.getByText("Flipkart needs reconnecting. Stock and orders aren't updating there.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reconnect" })).toBeInTheDocument();

    rerender(
      <ChannelAttentionBanner
        orgId="org_1"
        attention={[
          { channel: "flipkart", label: "Flipkart", state: "needs_reconnect", reapproveBy: null },
          { channel: "amazon", label: "Amazon", state: "renewal_due", reapproveBy: "2026-11-12T00:00:00.000Z" },
        ]}
      />,
    );
    expect(screen.getByText("2 channels need attention.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Channels" })).toHaveAttribute("href", "/org/org_1/channels");
  });
});
