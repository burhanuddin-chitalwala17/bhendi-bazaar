import { PlatformMark } from "@/components/ui/icons/platform-marks";
import { BrandLogo } from "@/components/layout/brand-logo";
import { CHANNEL, type Channel } from "@server/shared/channels";

/** Each channel's mark at card size: our own logo for the store, the platform's for the rest. */
export function channelMark(channel: Channel) {
  if (channel === CHANNEL.STORE) {
    return (
      <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-field border border-border bg-background p-1">
        <BrandLogo size="sm" className="dark:invert" />
      </span>
    );
  }
  return <PlatformMark name={channel} size="md" />;
}
