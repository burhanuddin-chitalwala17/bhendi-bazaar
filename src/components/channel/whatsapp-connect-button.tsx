"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { LockedAction } from "@/components/subscriptions/locked-action";
import { FEATURE } from "@/components/subscriptions/features";
import { CONNECT_RESULT, type ConnectResult } from "@server/channels/channel-connection.types";
import { SOCIAL_PLATFORM } from "@server/channels/social/types";
import { ROUTES } from "@server/shared/routes";

import { WHATSAPP } from "./channel-copy";
import { useWhatsAppSignup } from "./useWhatsAppSignup";

const FULL = "min-h-10 w-full md:w-auto";

/**
 * Connect WhatsApp (connect-whatsapp ux.md "First use", "Opening Meta"): Meta's SDK loads as the
 * shop reaches for the button, never with the page. A claimed number refreshes the card into Setting up; any other outcome is a return note.
 */
export function WhatsAppConnectButton({
  orgId,
  nonce,
  prefill,
  label = WHATSAPP.connect,
}: {
  orgId: string;
  /** This request's CSP nonce, read by the server page. */
  nonce?: string;
  prefill?: { name?: string; email?: string; website?: string };
  label?: string;
}) {
  const router = useRouter();
  const onResult = useCallback(
    (result: ConnectResult) => {
      if (result === CONNECT_RESULT.CONNECTED) return router.refresh();
      const back = new URLSearchParams({ result, channel: SOCIAL_PLATFORM.WHATSAPP });
      router.replace(`${ROUTES.org.channels(orgId)}?${back.toString()}`);
    },
    [orgId, router],
  );
  const { phase, prepare, connect } = useWhatsAppSignup(orgId, { nonce, prefill, onResult });
  const warm = () => void prepare().catch(() => undefined);
  const busy = phase !== "idle";

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-sm text-muted-foreground">{busy ? WHATSAPP.finishInMeta : WHATSAPP.beforeConsent}</p>
      <LockedAction feature={FEATURE.SOCIAL_SELLING} label={label} className={FULL}>
        <Button className={FULL} aria-busy={busy} onPointerEnter={warm} onPointerDown={warm} onFocus={warm} onClick={() => void connect()}>
          {busy ? (
            <>
              <Spinner />
              {WHATSAPP.opening}
            </>
          ) : (
            label
          )}
        </Button>
      </LockedAction>
    </div>
  );
}
