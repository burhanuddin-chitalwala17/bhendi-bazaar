"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useServerForm } from "@/hooks/core/useServerForm";
import { channelsApiClient } from "@/components/channel/channelsApiClient";
import {
  channelValueMappingSchema,
  type ChannelValueMappingInput,
} from "@/lib/validation/schemas/channel-mapping.schema";
import type { Channel } from "@server/shared/channels";
import type { UnmappedValue } from "@server/catalog/channel-register.service";

interface UnmappedValueRowProps {
  channel: Channel;
  entry: UnmappedValue;
}

/**
 * One decision in the worklist: what this channel calls one of our answers
 * ([channel-registry](../../../docs/specs/channel-registry/) R5, R8).
 *
 * Deliberately one field and one button per row. The alternative — a single form saving the
 * whole list — makes a long job one all-or-nothing act, when the point is that it can be done a
 * few at a time and each one immediately clears every product using that value.
 */
export function UnmappedValueRow({ channel, entry }: UnmappedValueRowProps) {
  const router = useRouter();
  const {
    register,
    onSubmit: handleFormSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<ChannelValueMappingInput>({
    schema: channelValueMappingSchema,
    // The three identifiers come from props, not from anything typed, so they are sent rather
    // than registered as fields: a bound field with no way to show an error refuses silently.
    submit: (data) =>
      channelsApiClient.mapValue({ ...data, channel, list: entry.list, valueKey: entry.valueKey }),
    successMessage: `Recorded what they call ${entry.label}`,
    onSuccess: () => router.refresh(),
    defaultValues: {
      channel,
      list: entry.list,
      valueKey: entry.valueKey,
      theirValue: "",
    },
  });

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-medium">{entry.label}</p>
        <p className="text-sm text-muted-foreground">
          {entry.products} {entry.products === 1 ? "product" : "products"} · {entry.list}
        </p>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <label htmlFor={`their-${entry.list}-${entry.valueKey}`} className="sr-only">
              What they call {entry.label}
            </label>
            <Input
              id={`their-${entry.list}-${entry.valueKey}`}
              placeholder="What they call it"
              autoComplete="off"
              {...register("theirValue")}
            />
            {errors.theirValue && (
              <p className="mt-1 text-sm text-destructive">{errors.theirValue.message}</p>
            )}
          </div>
          <Button type="submit" variant="outline" className="min-h-10" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Record"}
          </Button>
        </div>

        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
      </form>
    </li>
  );
}
