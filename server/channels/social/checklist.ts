/**
 * A social card's setup checklist (connect-instagram D4, R12; parent Q111): computed on every read
 * from facts other places own, never stored. Pure, so WhatsApp's card computes its own the same way.
 */

export const CHECKLIST_STEP = {
  CONNECT: "connect",
  REPLIES: "replies",
  FIRST_POST: "first_post",
  COMMENT_DM: "comment_dm",
} as const;
export type ChecklistStep = (typeof CHECKLIST_STEP)[keyof typeof CHECKLIST_STEP];

/** `waiting`: the shop did its part and we wait on the platform (the first message, Q16). */
export const STEP_STATE = { DONE: "done", NEXT: "next", WAITING: "waiting", TODO: "todo" } as const;
export type StepState = (typeof STEP_STATE)[keyof typeof STEP_STATE];

export interface ChecklistStepDTO {
  step: ChecklistStep;
  state: StepState;
}

export interface ChecklistFacts {
  connected: boolean;
  /** The shop said it turned message access on. */
  repliesAsked: boolean;
  /** A message has arrived since connecting. */
  messageArrived: boolean;
  /** Meta refused messages more recently than any arrived (D3). */
  messagesOff: boolean;
  posted: boolean;
  commentRuleOn: boolean;
}

/** The first step neither done nor waiting is the next, and the card's main button; the rest wait their turn. */
export function checklist(facts: ChecklistFacts): ChecklistStepDTO[] {
  const replies: StepState | null = facts.messagesOff
    ? null
    : facts.messageArrived
      ? STEP_STATE.DONE
      : facts.repliesAsked
        ? STEP_STATE.WAITING
        : null;
  const known: Array<[ChecklistStep, StepState | null]> = [
    [CHECKLIST_STEP.CONNECT, facts.connected ? STEP_STATE.DONE : null],
    [CHECKLIST_STEP.REPLIES, facts.connected ? replies : null],
    [CHECKLIST_STEP.FIRST_POST, facts.connected && facts.posted ? STEP_STATE.DONE : null],
    [CHECKLIST_STEP.COMMENT_DM, facts.connected && facts.commentRuleOn ? STEP_STATE.DONE : null],
  ];
  let nextGiven = false;
  return known.map(([step, state]) => {
    if (state) return { step, state };
    const open = nextGiven ? STEP_STATE.TODO : STEP_STATE.NEXT;
    nextGiven = true;
    return { step, state: open };
  });
}

export const setupDone = (steps: readonly ChecklistStepDTO[]): boolean => steps.every((s) => s.state === STEP_STATE.DONE);
