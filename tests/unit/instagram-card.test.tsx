/**
 * The Instagram card, its checklist, the Turn on replies sheet, the return notes and the disconnect
 * dialog read as connect-instagram ux.md wrote them (spec A1, A3, A4, A6, A8; R6, R7, R11, R12).
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { InstagramCard } from "@/components/channel/instagram-card";
import { InstagramResultNote } from "@/components/channel/connect-result-note";
import { ChannelCardList } from "@/components/channel/channel-card-list";
import { DisconnectDialog } from "@/components/channel/disconnect-dialog";
import { attentionLines } from "@/components/org/home/attention-lines";
import { CARD_STATE, CONNECT_RESULT, type ChannelCardDTO, type InstagramCardDTO } from "@server/channels/channel-connection.types";
import { checklist, setupDone, type ChecklistFacts } from "@server/channels/social/checklist";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const NOW = new Date().toISOString();
const facts = (over: Partial<ChecklistFacts> = {}): ChecklistFacts => ({
  connected: true,
  repliesAsked: false,
  messageArrived: false,
  messagesOff: false,
  posted: false,
  commentRuleOn: false,
  ...over,
});
const states = (over: Partial<ChecklistFacts>) => checklist(facts(over)).map((s) => `${s.step}:${s.state}`);

const notConnected: InstagramCardDTO = {
  state: CARD_STATE.NOT_CONNECTED,
  label: "Instagram",
  username: null,
  accountKind: null,
  connectedBy: null,
  connectedAt: null,
  disconnectedBy: null,
  disconnectedAt: null,
  lastCheckedAt: null,
  stale: false,
  reason: null,
  messagesOff: false,
  checklist: null,
};
const connected = (over: Partial<InstagramCardDTO> = {}, f: Partial<ChecklistFacts> = {}): InstagramCardDTO => ({
  ...notConnected,
  state: CARD_STATE.CONNECTED,
  username: "niqab.boutique",
  accountKind: "business",
  connectedBy: "Farida",
  connectedAt: NOW,
  lastCheckedAt: NOW,
  checklist: checklist(facts(f)),
  ...over,
});
const card = (dto: InstagramCardDTO) => render(<InstagramCard orgId="org_1" card={dto} />);

describe("the setup checklist (R12, D4)", () => {
  it("right after connecting: Connect ticked, Turn on replies next, the rest to do", () => {
    expect(states({})).toEqual(["connect:done", "replies:next", "first_post:todo", "comment_dm:todo"]);
  });

  it("once the shop says it turned replies on, the step waits for a message and First post is next", () => {
    expect(states({ repliesAsked: true })).toEqual(["connect:done", "replies:waiting", "first_post:next", "comment_dm:todo"]);
  });

  it("the first message ticks Turn on replies, whether or not the sheet's Done was tapped (Q16)", () => {
    expect(states({ messageArrived: true })).toEqual(["connect:done", "replies:done", "first_post:next", "comment_dm:todo"]);
  });

  it("Meta saying access is off puts Turn on replies back as the next step (D3)", () => {
    expect(states({ messageArrived: true, repliesAsked: true, messagesOff: true })).toEqual([
      "connect:done",
      "replies:next",
      "first_post:todo",
      "comment_dm:todo",
    ]);
  });

  it("every step done is Setup done; one open step is not", () => {
    expect(setupDone(checklist(facts({ messageArrived: true, posted: true, commentRuleOn: true })))).toBe(true);
    expect(setupDone(checklist(facts({ messageArrived: true, posted: true })))).toBe(false);
  });

  it("not connected: Connect is next and nothing else counts", () => {
    expect(states({ connected: false, messageArrived: true, posted: true })).toEqual([
      "connect:next",
      "replies:todo",
      "first_post:todo",
      "comment_dm:todo",
    ]);
  });
});

describe("the Instagram card (ux.md state matrix)", () => {
  it("first use: the pitch, the line before Instagram's page, and Connect Instagram as a link", () => {
    card(notConnected);
    expect(screen.getByText("Post, answer comments and DMs, and turn comments into sales.")).toBeInTheDocument();
    expect(screen.getByText("Needs an Instagram business or creator account (free to switch).")).toBeInTheDocument();
    expect(screen.getByText(/^Instagram will ask to let Bhendi Bazaar manage messages\./)).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect Instagram" })).toHaveAttribute("href", "/api/org/org_1/channels/instagram/connect");
  });

  it("A1 connected, setup open: @username · Business, who and when, the checklist, and Turn on replies as the main action", () => {
    card(connected());
    expect(screen.getByText("● Connected")).toBeInTheDocument();
    expect(screen.getByText("@niqab.boutique · Business")).toBeInTheDocument();
    expect(screen.getByText(/^Connected by Farida · /)).toBeInTheDocument();
    expect(screen.getByText("Last checked just now")).toBeInTheDocument();
    const steps = within(screen.getByRole("list", { name: "Setup" }));
    expect(steps.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Connect", "Turn on replies", "First post", "Comment-to-DM"]);
    expect(steps.getAllByRole("listitem")[1]).toHaveAttribute("aria-current", "step");
    expect(screen.getAllByRole("button", { name: "Turn on replies" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeEnabled();
  });

  it("a creator account says Creator", () => {
    card(connected({ accountKind: "creator" }));
    expect(screen.getByText("@niqab.boutique · Creator")).toBeInTheDocument();
  });

  it("waiting for a message: the step says so, with how to check it now, and no Turn on replies button", () => {
    card(connected({}, { repliesAsked: true }));
    expect(screen.getByText("Turn on replies · waiting for your first message")).toBeInTheDocument();
    expect(screen.getByText("To check it now, send @niqab.boutique a DM from another account.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Turn on replies/ })).toHaveLength(1);
  });

  it("message access off: Needs you, the sentence, and Show me how", () => {
    card(connected({ messagesOff: true }, { messageArrived: true, messagesOff: true }));
    expect(screen.getByText("Needs you")).toBeInTheDocument();
    expect(screen.getByText("Replies from here are off in Instagram. Switch them back on to answer DMs here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show me how" })).toBeEnabled();
  });

  it("setup done: the list folds to Setup done, and Disconnect stays", () => {
    card(connected({}, { messageArrived: true, posted: true, commentRuleOn: true }));
    expect(screen.getByText("Setup done")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Setup" })).toBeNull();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeEnabled();
  });

  it.each([
    ["revoked", "Instagram stopped accepting our access."],
    ["removed_in_app", "Bhendi Bazaar was removed in Instagram's settings."],
  ] as const)("A6 needs reconnecting (%s): says why, Reconnect, and Disconnect beside it", (reason, text) => {
    card({ ...connected(), state: CARD_STATE.NEEDS_RECONNECT, reason, checklist: null });
    expect(screen.getByText("Needs reconnecting")).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reconnect" })).toHaveAttribute("href", "/api/org/org_1/channels/instagram/connect");
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeEnabled();
    expect(screen.queryByRole("list", { name: "Setup" })).toBeNull();
  });

  it("stale: the last check in amber, with Check now", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    card(connected({ lastCheckedAt: threeDaysAgo, stale: true }));
    expect(screen.getByText("Last checked 3 days ago")).toHaveClass("text-warning");
    expect(screen.getByRole("button", { name: "Check now" })).toBeEnabled();
  });

  it("Turn on replies opens the sheet with the three taps and Open Instagram (R6)", async () => {
    card(connected());
    fireEvent.click(screen.getAllByRole("button", { name: "Turn on replies" })[0]);
    expect(await screen.findByText("Turn on replies from Bhendi Bazaar")).toBeInTheDocument();
    for (const step of ["1. Settings → Messages and story replies", "2. Message controls → Connected tools", "3. Turn on Allow access to messages"]) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
    expect(screen.getByText("🔒 Private to your shop · No one at Bhendi Bazaar reads your chats.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Instagram" })).toHaveAttribute("href", "https://www.instagram.com/");
    expect(screen.getByRole("button", { name: "Done" })).toBeEnabled();
  });
});

describe("the return note from Instagram (A1, A3, A4)", () => {
  const note = (result: (typeof CONNECT_RESULT)[keyof typeof CONNECT_RESULT]) => render(<InstagramResultNote orgId="org_1" result={result} />);

  it("A1 connected: says what is next, with Turn on replies", () => {
    note(CONNECT_RESULT.CONNECTED);
    expect(screen.getByText("Instagram connected. Next: turn on replies, so you can answer DMs from here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn on replies" })).toBeInTheDocument();
  });

  it("A3 a personal account: the steps to switch, and Try again", () => {
    note(CONNECT_RESULT.PERSONAL);
    expect(screen.getByText(/^That's a personal Instagram account\..*Switch to professional account\.$/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/api/org/org_1/channels/instagram/connect");
  });

  it("A4 another shop's account: the reason, and nothing to press", () => {
    note(CONNECT_RESULT.OTHER_SHOP);
    expect(
      screen.getByText("This Instagram account is already connected to another shop. An account can belong to one shop only; disconnect it there first."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("A4 a different account on reconnect: how to switch, and Disconnect", () => {
    note(CONNECT_RESULT.DIFFERENT_ACCOUNT);
    expect(screen.getByText(/^That's a different Instagram account from the one connected here\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
  });

  it.each([
    [CONNECT_RESULT.CANCELLED, "Nothing was connected. You can connect Instagram any time.", "Connect Instagram"],
    [CONNECT_RESULT.EXPIRED, "That link has expired. Start again from here.", "Connect Instagram"],
    [CONNECT_RESULT.UNREACHABLE, "Instagram didn't respond. Nothing was connected. Try again in a minute.", "Try again"],
  ] as const)("A2 %s: the sentence and its way back", (result, text, action) => {
    note(result);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: action })).toBeInTheDocument();
  });
});

describe("where the card sits (R11, Q13)", () => {
  const meta: ChannelCardDTO = {
    channel: "meta",
    label: "Meta (Facebook & Instagram)",
    state: CARD_STATE.FEED_OFF,
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

  it("open: Instagram follows Meta catalogue under Where you sell, and leaves Coming soon", () => {
    render(<ChannelCardList orgId="org_1" storePath={null} storeLabel={null} cards={[meta]} instagram={notConnected} />);
    const live = within(screen.getByRole("region", { name: "Where you sell" }));
    const titles = live.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(["Meta catalogue", "Instagram"]);
    expect(live.getByText("Your products in Facebook and Instagram shops, from your catalogue feed.")).toBeInTheDocument();
    const soon = within(screen.getByRole("region", { name: "Coming soon" }));
    expect(soon.queryByText("Instagram")).toBeNull();
    expect(soon.getByText("WhatsApp")).toBeInTheDocument();
  });

  it("not open: no Instagram card, and Instagram stays under Coming soon", () => {
    render(<ChannelCardList orgId="org_1" storePath={null} storeLabel={null} cards={[meta]} instagram={null} />);
    expect(within(screen.getByRole("region", { name: "Where you sell" })).queryByText("Instagram")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Coming soon" })).getByText("Instagram")).toBeInTheDocument();
  });
});

describe("disconnecting Instagram (R10)", () => {
  it("says what stops, what stays, and how to remove us inside Instagram, with no marketplace warning", () => {
    render(<DisconnectDialog orgId="org_1" channel="instagram" label="Instagram" open onOpenChange={() => undefined} />);
    expect(screen.getByText("Disconnect Instagram?")).toBeInTheDocument();
    expect(screen.getByText("scheduled posts won't publish, and new comments and DMs stop arriving here.")).toBeInTheDocument();
    expect(screen.getByText("your posts on Instagram stay as they are.")).toBeInTheDocument();
    expect(
      screen.getByText("To remove us completely, also remove Bhendi Bazaar in Instagram: Settings → Website permissions → Apps and websites."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Watch out/)).toBeNull();
    expect(screen.getByRole("button", { name: "Keep connected" })).toBeInTheDocument();
  });
});

describe("Home's Instagram line (R9, A6)", () => {
  it("says posts won't publish until it is reconnected, and opens Channels", () => {
    const quiet = {
      toPack: { ok: true, value: { count: 0, oldestPaidAt: null } },
      lowStock: { ok: true, value: { count: 0, soldOut: 0, soonestDays: null } },
      channel: { ok: true, value: { channel: "instagram", label: "Instagram", state: CARD_STATE.NEEDS_RECONNECT, reapproveBy: null } },
      stock: { ok: true, value: null },
      listingProblems: { ok: true, value: null },
      channelAsks: { ok: true, value: null },
      channelNeeds: { ok: true, value: [] },
      photos: { ok: true, value: 0 },
      teamEdits: { ok: true, value: { count: 0, productId: null } },
    } satisfies Parameters<typeof attentionLines>[1];
    const [line] = attentionLines("o1", quiet, new Date());
    expect(line).toMatchObject({ text: "Instagram needs reconnecting. Posts won't publish until it is.", href: "/org/o1/channels" });
  });
});
