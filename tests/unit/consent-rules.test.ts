// social-selling/consent-core D2 and R5: the answer to "may S message this person on C?" and which
// consent changes are allowed, as pure rules. The integration suite proves them against Postgres.
import { describe, expect, it } from "vitest";

import { answerMay, nextConsent } from "@server/audience/consent-rules";
import {
  CONSENT_CHANGE,
  CONSENT_CHANNEL,
  CONSENT_SOURCE,
  CONSENT_STATE,
  MAY_REASON,
  PLATFORM_SENDER,
} from "@server/audience/consent.types";

const shopA = "org_a";
const shopB = "org_b";
const reachable = { orgId: shopA, phoneE164: "+919800000001", bsuid: null, email: "a@example.invalid" };

describe("answerMay (consent-core D2)", () => {
  it("says yes to the contact's own shop when it is opted in on that channel", () => {
    expect(answerMay(reachable, shopA, CONSENT_CHANNEL.WHATSAPP, CONSENT_STATE.OPTED_IN)).toEqual({ yes: true });
  });

  it("says no to another shop, with the reason, even if a row were present (spec A2)", () => {
    expect(answerMay(reachable, shopB, CONSENT_CHANNEL.WHATSAPP, CONSENT_STATE.OPTED_IN)).toEqual({
      yes: false,
      reason: MAY_REASON.NOT_OPTED_IN,
    });
  });

  it("answers the platform from its own consent on any shop's contact (parent Q27)", () => {
    expect(answerMay(reachable, PLATFORM_SENDER, CONSENT_CHANNEL.EMAIL, CONSENT_STATE.OPTED_IN)).toEqual({ yes: true });
    expect(answerMay(reachable, PLATFORM_SENDER, CONSENT_CHANNEL.EMAIL, null)).toEqual({
      yes: false,
      reason: MAY_REASON.NOT_OPTED_IN,
    });
  });

  it("says no, not opted in, when no consent row exists: Not yet is an absence (Q7)", () => {
    expect(answerMay(reachable, shopA, CONSENT_CHANNEL.WHATSAPP, null)).toEqual({ yes: false, reason: MAY_REASON.NOT_OPTED_IN });
  });

  it("says no, stopped, after a STOP (Q9)", () => {
    expect(answerMay(reachable, shopA, CONSENT_CHANNEL.WHATSAPP, CONSENT_STATE.STOPPED)).toEqual({
      yes: false,
      reason: MAY_REASON.STOPPED,
    });
  });

  it("says no, no channel, when the contact has no address on it", () => {
    const phoneOnly = { ...reachable, email: null };
    expect(answerMay(phoneOnly, shopA, CONSENT_CHANNEL.EMAIL, CONSENT_STATE.OPTED_IN)).toEqual({
      yes: false,
      reason: MAY_REASON.NO_CHANNEL,
    });
    const bsuidOnly = { ...reachable, phoneE164: null, bsuid: "IN.123" };
    expect(answerMay(bsuidOnly, shopA, CONSENT_CHANNEL.WHATSAPP, CONSENT_STATE.OPTED_IN)).toEqual({ yes: true });
    const noWhatsApp = { ...reachable, phoneE164: null, bsuid: null };
    expect(answerMay(noWhatsApp, shopA, CONSENT_CHANNEL.WHATSAPP, CONSENT_STATE.OPTED_IN)).toEqual({
      yes: false,
      reason: MAY_REASON.NO_CHANNEL,
    });
  });

  it("says no for a contact that does not exist", () => {
    expect(answerMay(null, shopA, CONSENT_CHANNEL.WHATSAPP, null)).toEqual({ yes: false, reason: MAY_REASON.NOT_OPTED_IN });
  });
});

describe("nextConsent (consent-core R2, R5)", () => {
  it("opts in from nothing, and stops an opted-in contact", () => {
    expect(nextConsent(null, CONSENT_CHANGE.OPT_IN, CONSENT_SOURCE.CHAT_KEYWORD)).toBe(CONSENT_STATE.OPTED_IN);
    expect(nextConsent(CONSENT_STATE.OPTED_IN, CONSENT_CHANGE.STOP, CONSENT_SOURCE.CHAT_KEYWORD)).toBe(CONSENT_STATE.STOPPED);
  });

  it("lets a stopped person opt in again by any source but an upload (spec A4, Q9)", () => {
    expect(nextConsent(CONSENT_STATE.STOPPED, CONSENT_CHANGE.OPT_IN, CONSENT_SOURCE.CHECKOUT_BOX)).toBe(CONSENT_STATE.OPTED_IN);
    expect(nextConsent(CONSENT_STATE.STOPPED, CONSENT_CHANGE.OPT_IN, CONSENT_SOURCE.FILE_UPLOAD)).toBeNull();
  });

  it("records nothing when the state would not change: history holds changes only (Q7)", () => {
    expect(nextConsent(CONSENT_STATE.OPTED_IN, CONSENT_CHANGE.OPT_IN, CONSENT_SOURCE.CHECKOUT_BOX)).toBeNull();
    expect(nextConsent(CONSENT_STATE.STOPPED, CONSENT_CHANGE.STOP, CONSENT_SOURCE.CHAT_KEYWORD)).toBeNull();
  });

  it("records a STOP even with no opt-in before it, so a later upload cannot add them (Q9)", () => {
    expect(nextConsent(null, CONSENT_CHANGE.STOP, CONSENT_SOURCE.CHAT_KEYWORD)).toBe(CONSENT_STATE.STOPPED);
  });
});
