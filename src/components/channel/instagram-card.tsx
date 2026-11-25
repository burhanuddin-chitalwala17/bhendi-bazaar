import { CARD_STATE, type InstagramCardDTO } from "@server/channels/channel-connection.types";
import { CHECKLIST_STEP, STEP_STATE, setupDone } from "@server/channels/social/checklist";
import { Button } from "@/components/ui/button";
import { PlatformMark } from "@/components/ui/icons/platform-marks";

import { ChannelCardShell } from "./channel-card-shell";
import { ChannelSetupChecklist, type ChecklistRow } from "./channel-setup-checklist";
import { CARD, CHIP, INSTAGRAM, lastChecked } from "./channel-copy";
import { ExpandableLine } from "./expandable-line";
import { InstagramCardActions, type InstagramMainAction } from "./instagram-card-actions";
import { TurnOnRepliesSheet } from "./turn-on-replies-sheet";

const chipFor = (card: InstagramCardDTO) => {
  if (card.state === CARD_STATE.NEEDS_RECONNECT) return { tone: "problem" as const, text: CHIP.needsReconnect };
  if (card.messagesOff) return { tone: "attention" as const, text: INSTAGRAM.needsYou };
  if (card.state === CARD_STATE.CONNECTED) return { tone: "connected" as const, text: CHIP.connected };
  return { tone: "muted" as const, text: CHIP.notConnected };
};

/** Only Turn on replies has its own screen yet; First post and Comment-to-DM arrive with their modules (Q19). */
function mainAction(card: InstagramCardDTO): InstagramMainAction {
  if (card.messagesOff) return "show_me_how";
  const next = card.checklist?.find((row) => row.state === STEP_STATE.NEXT);
  return next?.step === CHECKLIST_STEP.REPLIES ? "replies" : null;
}

/**
 * The Instagram card (connect-instagram ux.md "State matrix — Instagram card"), after Meta catalogue
 * (R11). Renders on the server; the buttons and the Turn on replies sheet are the client leaves.
 */
export function InstagramCard({ orgId, card }: { orgId: string; card: InstagramCardDTO }) {
  const connected = card.state === CARD_STATE.CONNECTED;
  const live = card.state !== CARD_STATE.NOT_CONNECTED;
  const done = card.checklist !== null && setupDone(card.checklist);
  const rows: ChecklistRow[] = (card.checklist ?? []).map((row) => ({
    ...row,
    label: INSTAGRAM.steps[row.step],
    hint: row.step === CHECKLIST_STEP.REPLIES && row.state === STEP_STATE.WAITING && card.username ? INSTAGRAM.checkItNow(card.username) : undefined,
    open:
      row.step === CHECKLIST_STEP.REPLIES
        ? (label) => (
            <TurnOnRepliesSheet
              orgId={orgId}
              trigger={
                <Button variant="ghost" className="h-auto min-h-10 w-full justify-start whitespace-normal p-0 font-normal hover:bg-transparent">
                  {label}
                </Button>
              }
            />
          )
        : undefined,
  }));

  return (
    <ChannelCardShell
      label={card.label}
      purpose={INSTAGRAM.purpose}
      mark={<PlatformMark name="instagram" size="md" />}
      chip={chipFor(card)}
      actions={<InstagramCardActions orgId={orgId} card={card} main={connected ? mainAction(card) : null} />}
    >
      {!live && (
        <>
          {card.disconnectedAt ? <p>{CARD.disconnectedBy(card.disconnectedBy, card.disconnectedAt)}</p> : <p>{INSTAGRAM.needsProfessional}</p>}
          <p>{INSTAGRAM.beforeConsent}</p>
        </>
      )}
      {card.state === CARD_STATE.NEEDS_RECONNECT && <p>{INSTAGRAM.reason(card.reason)}</p>}
      {live && card.username && (
        <ExpandableLine>{INSTAGRAM.account(card.username, card.accountKind ? INSTAGRAM.kind[card.accountKind] : null)}</ExpandableLine>
      )}
      {connected && card.messagesOff && <p className="font-medium text-warning">{INSTAGRAM.messagesOff}</p>}
      {live && card.connectedAt && <ExpandableLine>{CARD.connectedBy(card.connectedBy, card.connectedAt)}</ExpandableLine>}
      {live && card.lastCheckedAt && <p className={card.stale ? "font-medium text-warning" : undefined}>{lastChecked(card.lastCheckedAt)}</p>}
      {connected && !done && <ChannelSetupChecklist label={INSTAGRAM.stepsLabel} rows={rows} waitingText={INSTAGRAM.waiting} />}
      {connected && done && <p>{INSTAGRAM.setupDone}</p>}
    </ChannelCardShell>
  );
}
