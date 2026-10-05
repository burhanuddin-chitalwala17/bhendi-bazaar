"use client";

import { useRouter } from "next/navigation";
import { Controller } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useServerForm } from "@/hooks/core/useServerForm";
import { channelsApiClient } from "@/components/channel/channelsApiClient";
import {
  orgChannelsSchema,
  type OrgChannelsParsed,
} from "@/lib/validation/schemas/org-channels.schema";
import { CHANNEL_KIND } from "@server/shared/channels";
import type { OrgChannelChoice } from "@server/catalog/org-channel.service";

interface WhereYouSellProps {
  orgId: string;
  choices: OrgChannelChoice[];
}

/** What turning one on actually buys, in the shop's terms rather than the architecture's. */
const KIND_HINT: Record<string, string> = {
  [CHANNEL_KIND.SHOPFRONT]: "Your products are listed there; the sale still happens here.",
  [CHANNEL_KIND.MARKETPLACE]: "Your products are listed there and sold there.",
};

/**
 * Where a shop sells ([channel-registry](../../../docs/specs/channel-registry/) R9).
 *
 * Off is the default and saying nothing is a complete answer, so nothing here is required and
 * the section is as useful left alone as filled in. Turning one on is what makes this shop start
 * hearing whether its products are ready for it — and nothing else: no credentials are asked for
 * and nothing is sent anywhere yet.
 */
export function WhereYouSell({ orgId, choices }: WhereYouSellProps) {
  const router = useRouter();
  const {
    control,
    onSubmit: handleFormSubmit,
    formError,
    formState: { isSubmitting },
  } = useServerForm<OrgChannelsParsed>({
    schema: orgChannelsSchema,
    submit: (data) => channelsApiClient.saveOrgChannels(orgId, data),
    successMessage: "Saved where you sell",
    onSuccess: () => router.refresh(),
    defaultValues: {
      channels: choices.map(({ channel, enabled }) => ({ channel, enabled })),
    },
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <ul className="divide-y rounded-card border">
        {choices.map((choice, index) => (
          <li key={choice.channel} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <label htmlFor={`channel-${choice.channel}`} className="text-sm font-medium">
                {choice.label}
              </label>
              <p className="text-sm text-muted-foreground">{KIND_HINT[choice.kind]}</p>
            </div>
            <Controller
              control={control}
              name={`channels.${index}.enabled`}
              render={({ field }) => (
                <Switch
                  id={`channel-${choice.channel}`}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  // The row is the target on a phone; the switch alone is under 40px.
                  className="shrink-0"
                />
              )}
            />
          </li>
        ))}
      </ul>

      <Button type="submit" className="min-h-10 w-full sm:w-auto" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
