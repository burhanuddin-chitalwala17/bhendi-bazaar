import { FACT_KIND } from "@server/shared/social-events/facts";
import { registerSink } from "@server/shared/social-events/sinks";
import { inboxIntake } from "./inbox-intake.service";

/**
 * The inbox's sinks (inbox-core D2), registered when the worker imports `inbox.jobs.ts`. Order 0: the
 * inbox stores a message before automations or channels act on it (A-D7).
 */

const FIRST = 0;

registerSink({ name: "inbox.inbound-message", kind: FACT_KIND.INBOUND_MESSAGE, order: FIRST, handle: (facts) => inboxIntake.messages(facts, true) });
registerSink({ name: "inbox.outbound-echo", kind: FACT_KIND.OUTBOUND_ECHO, order: FIRST, handle: (facts) => inboxIntake.messages(facts, false) });
registerSink({ name: "inbox.message-status", kind: FACT_KIND.MESSAGE_STATUS, order: FIRST, handle: (facts) => inboxIntake.statuses(facts) });
registerSink({ name: "inbox.reaction", kind: FACT_KIND.REACTION, order: FIRST, handle: (facts) => inboxIntake.reactions(facts) });
registerSink({ name: "inbox.message-edit", kind: FACT_KIND.MESSAGE_EDIT, order: FIRST, handle: (facts) => inboxIntake.edits(facts) });
registerSink({ name: "inbox.comment", kind: FACT_KIND.COMMENT, order: FIRST, handle: (facts) => inboxIntake.comments(facts) });
registerSink({ name: "inbox.cart-order", kind: FACT_KIND.CART_ORDER, order: FIRST, handle: (facts) => inboxIntake.carts(facts) });
registerSink({ name: "inbox.person-rekeyed", kind: FACT_KIND.PERSON_REKEYED, order: FIRST, handle: (facts) => inboxIntake.rekeys(facts) });
