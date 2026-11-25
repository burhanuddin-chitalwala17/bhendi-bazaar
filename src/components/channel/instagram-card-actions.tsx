"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { LockedAction } from "@/components/subscriptions/locked-action";
import { FEATURE } from "@/components/subscriptions/features";
import { useMutation } from "@/hooks/core/useMutation";
import { CARD_STATE, type InstagramCardDTO } from "@server/channels/channel-connection.types";
import { SOCIAL_PLATFORM } from "@server/channels/social/types";

import { channelsApiClient } from "./channelsApiClient";
import { ACTION, CHECK_RESULT, INSTAGRAM } from "./channel-copy";
import { DisconnectDialog } from "./disconnect-dialog";
import { TurnOnRepliesSheet } from "./turn-on-replies-sheet";

const CHANNEL = SOCIAL_PLATFORM.INSTAGRAM;
const FULL = "min-h-10 w-full md:w-auto";

/** The main action ux.md gives a connected card, when its next step has a screen to open. */
export type InstagramMainAction = "replies" | "show_me_how" | null;

/**
 * The Instagram card's buttons (connect-instagram ux.md). Never disabled (ADR-0053): Connect keeps
 * its place behind the Social selling lock and opens the plan sheet. Connect and Reconnect are links.
 */
export function InstagramCardActions({ orgId, card, main }: { orgId: string; card: InstagramCardDTO; main: InstagramMainAction }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [slow, setSlow] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  useEffect(() => {
    if (!opening) return;
    const timer = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(timer);
  }, [opening]);

  const check = useMutation(() => channelsApiClient.checkNow(orgId, CHANNEL), {
    showToast: false,
    onSuccess: ({ result }) => {
      if (result === "ok") toast.success(CHECK_RESULT.ok);
      else if (result === "needs_reconnect") toast.error(CHECK_RESULT.needs_reconnect);
      else toast.error(CHECK_RESULT.unreachable(card.label));
      router.refresh();
    },
    onError: () => toast.error(CHECK_RESULT.unreachable(card.label)),
  });

  const goTo = (text: string) => (
    <LockedAction feature={FEATURE.SOCIAL_SELLING} label={text} className={FULL}>
      <Button asChild className={FULL}>
        <a href={channelsApiClient.connectUrl(orgId, CHANNEL)} onClick={() => setOpening(true)} aria-busy={opening}>
          {opening ? (
            <>
              <Spinner />
              {ACTION.connecting(card.label)}
              {slow ? ` ${ACTION.stillWorking}` : ""}
            </>
          ) : (
            text
          )}
        </a>
      </Button>
    </LockedAction>
  );

  const disconnect = (
    <>
      <Button variant="ghost" className="min-h-10 text-destructive hover:text-destructive md:ml-auto" onClick={() => setDisconnectOpen(true)}>
        {ACTION.disconnect}
      </Button>
      <DisconnectDialog orgId={orgId} channel={CHANNEL} label={card.label} open={disconnectOpen} onOpenChange={setDisconnectOpen} />
    </>
  );

  if (card.state === CARD_STATE.NOT_CONNECTED) return goTo(ACTION.connect(card.label));
  if (card.state === CARD_STATE.NEEDS_RECONNECT) {
    return (
      <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
        {goTo(ACTION.reconnect)}
        {disconnect}
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
      {main && (
        <TurnOnRepliesSheet
          orgId={orgId}
          trigger={<Button className={FULL}>{main === "show_me_how" ? INSTAGRAM.showMeHow : INSTAGRAM.steps.replies}</Button>}
        />
      )}
      {card.stale && (
        <LockedAction feature={FEATURE.SOCIAL_SELLING} label={ACTION.checkNow} variant="outline" className={FULL}>
          <Button variant="outline" className={FULL} pending={check.isLoading} onClick={() => void check.mutate().catch(() => undefined)}>
            {check.isLoading ? INSTAGRAM.checking : ACTION.checkNow}
          </Button>
        </LockedAction>
      )}
      {disconnect}
    </div>
  );
}
