/**
 * A listing not yet on a marketplace says where its create stands, not "6 changes waiting" or "Nothing was
 * created" while Amazon is making the page (2026-11-20, marketplace-publish copy).
 */
import { describe, expect, it } from "vitest";

import { LISTING_STATUS } from "@server/channels/platform-listing.types";
import { CREATE, saveBarStatus } from "@/components/channel/platform-listing-copy";

describe("a draft's words follow where its create stands", () => {
  it("the draft panel: waiting here, being sent, or accepted and waiting to go on sale", () => {
    expect(CREATE.draftNoteFor(LISTING_STATUS.DRAFT, "Amazon")).toBe("Nothing was created on Amazon; the draft waits here.");
    expect(CREATE.draftNoteFor(LISTING_STATUS.ATTENTION, "Amazon")).toBe("Nothing was created on Amazon; the draft waits here.");
    expect(CREATE.draftNoteFor(LISTING_STATUS.SENT, "Amazon")).toBe("Sending to Amazon…");
    expect(CREATE.draftNoteFor(LISTING_STATUS.CHECKING, "Amazon")).toBe("Accepted by Amazon · waiting for it to go on sale.");
    expect(CREATE.draftNoteFor(LISTING_STATUS.UNANSWERED, "Amazon")).toBe("Amazon hasn't answered yet; the page may still appear there.");
  });

  it("the save bar: a draft is ready to create, never a count of all six fields", () => {
    expect(saveBarStatus({ draft: true, sending: false, waiting: 6, label: "Amazon", status: LISTING_STATUS.DRAFT })).toBe("Not on Amazon yet · ready to create");
    // Refused or unanswered, a draft shows where it stands, not "ready".
    expect(saveBarStatus({ draft: true, sending: false, waiting: 6, label: "Amazon", status: LISTING_STATUS.ATTENTION })).toBeNull();
    expect(saveBarStatus({ draft: true, sending: false, waiting: 6, label: "Amazon", status: LISTING_STATUS.UNANSWERED })).toBeNull();
    expect(saveBarStatus({ draft: false, sending: false, waiting: 2, label: "Amazon", status: LISTING_STATUS.WAITING })).toBe("2 changes waiting");
    expect(saveBarStatus({ draft: false, sending: false, waiting: 0, label: "Amazon", status: LISTING_STATUS.LIVE })).toBe("Nothing waiting");
  });
});
