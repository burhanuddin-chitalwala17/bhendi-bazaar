"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CONNECT_RESULT, type ConnectResult, type MarketplaceChannel } from "@server/channels/channel-connection.types";
import { SOCIAL_PLATFORM, SOCIAL_PLATFORM_LABELS } from "@server/channels/social/types";

import { channelsApiClient } from "./channelsApiClient";
import { ACTION, INSTAGRAM, INSTAGRAM_RESULT_NOTE, RESULT_NOTE, type NoteTone } from "./channel-copy";
import { DisconnectDialog } from "./disconnect-dialog";
import { TurnOnRepliesSheet } from "./turn-on-replies-sheet";

const TONE: Record<NoteTone, string> = {
  success: "border border-success/30 bg-success/10",
  info: "bg-primary/10",
  neutral: "bg-muted",
  warning: "border border-warning bg-warning/10",
  error: "border border-destructive bg-destructive/10",
};

/** The `?result=` is dropped from the address once read, so a refresh does not repeat the note. */
function useForgetResult() {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("result");
    url.searchParams.delete("channel");
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);
}

interface ConnectResultNoteProps {
  orgId: string;
  channel: MarketplaceChannel;
  label: string;
  result: ConnectResult;
}

/**
 * What happened on the way back from a marketplace (ux.md "Return outcome note"). Shown once: the
 * `?result=` is dropped from the address so a refresh does not repeat it.
 */
export function ConnectResultNote({ orgId, channel, label, result }: ConnectResultNoteProps) {
  const note = RESULT_NOTE[result];
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  useEffect(() => {
    if (note.tone === "success") toast.success(note.text(label));
    const url = new URL(window.location.href);
    url.searchParams.delete("result");
    url.searchParams.delete("channel");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [note, label]);

  if (note.tone === "success") return null;
  return (
    <div role="status" className={cn("flex flex-col gap-2 rounded-card p-3 text-sm", TONE[note.tone])}>
      <p>{note.text(label)}</p>
      {note.retry && (
        <Button asChild variant="outline" size="sm" className="min-h-10 self-start">
          <a href={channelsApiClient.connectUrl(orgId, channel)}>
            {result === CONNECT_RESULT.UNREACHABLE ? ACTION.tryAgain : ACTION.connect(label)}
          </a>
        </Button>
      )}
      {result === CONNECT_RESULT.DIFFERENT_ACCOUNT && (
        <>
          <Button variant="outline" size="sm" className="min-h-10 self-start" onClick={() => setDisconnectOpen(true)}>
            {ACTION.disconnect}
          </Button>
          <DisconnectDialog orgId={orgId} channel={channel} label={label} open={disconnectOpen} onOpenChange={setDisconnectOpen} />
        </>
      )}
    </div>
  );
}

/**
 * What happened on the way back from Instagram (connect-instagram ux.md "Return note"). Connected is
 * a note too, not only a toast: it hands the shop straight to Turn on replies.
 */
const LABEL = SOCIAL_PLATFORM_LABELS[SOCIAL_PLATFORM.INSTAGRAM];

export function InstagramResultNote({ orgId, result }: { orgId: string; result: ConnectResult }) {
  const note = INSTAGRAM_RESULT_NOTE[result];
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  useForgetResult();

  const connectHref = channelsApiClient.connectUrl(orgId, SOCIAL_PLATFORM.INSTAGRAM);
  return (
    <div role="status" className={cn("flex flex-col gap-2 rounded-card p-3 text-sm", TONE[note.tone])}>
      <p>{note.text}</p>
      {note.action === "replies" && (
        <TurnOnRepliesSheet
          orgId={orgId}
          trigger={
            <Button variant="outline" size="sm" className="min-h-10 self-start">
              {INSTAGRAM.steps.replies}
            </Button>
          }
        />
      )}
      {(note.action === "connect" || note.action === "retry") && (
        <Button asChild variant="outline" size="sm" className="min-h-10 self-start">
          <a href={connectHref}>{note.action === "retry" ? ACTION.tryAgain : ACTION.connect(LABEL)}</a>
        </Button>
      )}
      {note.action === "disconnect" && (
        <>
          <Button variant="outline" size="sm" className="min-h-10 self-start" onClick={() => setDisconnectOpen(true)}>
            {ACTION.disconnect}
          </Button>
          <DisconnectDialog
            orgId={orgId}
            channel={SOCIAL_PLATFORM.INSTAGRAM}
            label={LABEL}
            open={disconnectOpen}
            onOpenChange={setDisconnectOpen}
          />
        </>
      )}
    </div>
  );
}
