"use client";

import { useEffect, useState } from "react";

/**
 * Time left, counted against the platform's clock rather than the device's (spec R17).
 *
 * The page ships `serverNow` alongside `endAt`; the offset between that and the
 * device's own clock is measured once on mount and applied to every tick. A phone
 * twenty minutes fast then still shows the right number. Network latency shifts this
 * by a second or two, which does not matter — the countdown is display, and the server
 * decides a late bid against its own clock regardless.
 */
export function BidCountdown({
  endAt,
  serverNow,
  onExpire,
  className,
}: {
  endAt: string;
  serverNow: string;
  onExpire?: () => void;
  className?: string;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(endAt).getTime() - new Date(serverNow).getTime())
  );

  useEffect(() => {
    const offset = new Date(serverNow).getTime() - Date.now();
    const end = new Date(endAt).getTime();

    const tick = () => {
      const left = Math.max(0, end - (Date.now() + offset));
      setRemaining(left);
      if (left === 0) onExpire?.();
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endAt, serverNow, onExpire]);

  if (remaining === 0) {
    return <span className={className}>Bidding has closed</span>;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <span className={className} suppressHydrationWarning>
      {days > 0 && `${days}d `}
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
