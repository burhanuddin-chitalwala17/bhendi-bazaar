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
  });

  it("the save bar: a draft is ready to create, never a count of all six fields", () => {
    expect(saveBarStatus({ draft: true, sending: false, waiting: 6, label: "Amazon" })).toBe("Not on Amazon yet · ready to create");
    expect(saveBarStatus({ draft: false, sending: false, waiting: 2, label: "Amazon" })).toBe("2 changes waiting");
    expect(saveBarStatus({ draft: false, sending: false, waiting: 0, label: "Amazon" })).toBe("Nothing waiting");
  });
});
