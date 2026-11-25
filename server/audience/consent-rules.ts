import {
  CONSENT_CHANGE,
  CONSENT_CHANNEL,
  CONSENT_SOURCE,
  CONSENT_STATE,
  MAY_REASON,
  PLATFORM_SENDER,
  type ConsentChange,
  type ConsentChannel,
  type ConsentSource,
  type ConsentState,
  type ContactReach,
  type MayAnswer,
  type MayReason,
  type Sender,
} from "./consent.types";

const no = (reason: MayReason): MayAnswer => ({ yes: false, reason });

function reachable(contact: ContactReach, channel: ConsentChannel): boolean {
  if (channel === CONSENT_CHANNEL.EMAIL) return contact.email !== null;
  return contact.phoneE164 !== null || contact.bsuid !== null;
}

/**
 * consent-core D2. A shop is only ever answered about its own contacts (R1): the sender check holds
 * even if a stray row for another shop existed.
 */
export function answerMay(
  contact: ContactReach | null,
  sender: Sender,
  channel: ConsentChannel,
  state: ConsentState | null,
): MayAnswer {
  if (!contact) return no(MAY_REASON.NOT_OPTED_IN);
  if (sender !== PLATFORM_SENDER && sender !== contact.orgId) return no(MAY_REASON.NOT_OPTED_IN);
  if (state === CONSENT_STATE.STOPPED) return no(MAY_REASON.STOPPED);
  if (!reachable(contact, channel)) return no(MAY_REASON.NO_CHANNEL);
  if (state !== CONSENT_STATE.OPTED_IN) return no(MAY_REASON.NOT_OPTED_IN);
  return { yes: true };
}

/** The state a change leads to, or null when nothing is recorded: no change, or an upload meeting a STOP (Q9). */
export function nextConsent(current: ConsentState | null, change: ConsentChange, source: ConsentSource): ConsentState | null {
  const next = change === CONSENT_CHANGE.OPT_IN ? CONSENT_STATE.OPTED_IN : CONSENT_STATE.STOPPED;
  if (next === current) return null;
  if (current === CONSENT_STATE.STOPPED && source === CONSENT_SOURCE.FILE_UPLOAD) return null;
  return next;
}
