"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ResponsivePicker } from "@/components/shared/overlays/responsive-picker";
import { useMutation } from "@/hooks/core/useMutation";
import type { LocationMatchDTO } from "@server/channels/channel-stock.types";

import { channelsApiClient } from "./channelsApiClient";
import { LOCATIONS, STOCK } from "./stock-copy";

const NOT_USED = "not-used";

/**
 * Match locations (inventory-sync ux.md, Q15, Q16): each marketplace location to one of the shop's,
 * or not used. One location is one choice. Saved only when the owner taps save.
 */
export function LocationMatchSheet({ orgId, match, trigger }: { orgId: string; match: LocationMatchDTO; trigger: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const live = match.locations.filter((l) => !l.gone);
  const [picked, setPicked] = useState<Record<string, string>>(() =>
    Object.fromEntries(match.locations.map((l) => [l.id, l.notUsed ? NOT_USED : (l.closed ? "" : (l.orgAddressId ?? l.suggestedId ?? ""))])),
  );
  const save = useMutation(
    () =>
      channelsApiClient.matchLocations(orgId, match.channel, {
        matches: live
          .filter((l) => picked[l.id])
          .map((l) => ({ id: l.id, orgAddressId: picked[l.id] === NOT_USED ? null : picked[l.id], notUsed: picked[l.id] === NOT_USED })),
      }),
    {
      showToast: false,
      onSuccess: () => {
        toast.success(LOCATIONS.saved);
        setOpen(false);
        router.refresh();
      },
      onError: (error) => toast.error(error.message || STOCK.failed),
    },
  );
  const l = match.label;
  const shop = match.shopLocations.filter((s) => s.isActive);
  const one = live.length === 1;

  return (
    <ResponsivePicker open={open} onOpenChange={setOpen} trigger={trigger} title={one ? LOCATIONS.oneTitle(l) : LOCATIONS.title(l)} description={one ? LOCATIONS.one(l) : LOCATIONS.hint(l)} className="w-96">
      <div className="flex flex-col gap-4">
        {match.locations.map((loc) =>
          loc.gone ? (
            <div key={loc.id} className="flex flex-col gap-1 border-t pt-3 text-sm">
              <span>
                <strong>{loc.name}</strong> <span className="text-muted-foreground">· {LOCATIONS.gone(l)}</span>
              </span>
              <span className="text-muted-foreground">{LOCATIONS.goneHint}</span>
            </div>
          ) : (
            <div key={loc.id} className="flex flex-col gap-2 border-t pt-3">
              <label htmlFor={`loc-${loc.id}`} className="text-sm">
                <strong>{loc.name}</strong>
                {loc.pincode ? ` · ${loc.pincode}` : ""} <span className="text-muted-foreground">· {l}</span>
              </label>
              {loc.closed && <span className="text-sm text-warning">{LOCATIONS.closed(shop.find((s) => s.id === loc.orgAddressId)?.name ?? match.shopLocations.find((s) => s.id === loc.orgAddressId)?.name ?? "")}</span>}
              {!loc.closed && !loc.suggestedId && !loc.orgAddressId && !loc.notUsed && <span className="text-sm text-warning">{LOCATIONS.pickOne}</span>}
              <Select id={`loc-${loc.id}`} value={picked[loc.id] ?? ""} onChange={(e) => setPicked((p) => ({ ...p, [loc.id]: e.target.value }))}>
                <option value="">{LOCATIONS.choose}</option>
                {shop.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.pincode}
                    {loc.suggestedId === s.id && !loc.orgAddressId ? ` ${LOCATIONS.suggested}` : ""}
                  </option>
                ))}
                {!one && <option value={NOT_USED}>{LOCATIONS.notUsed}</option>}
              </Select>
            </div>
          ),
        )}
        <Button
          className="min-h-10"
          aria-busy={save.isLoading}
          onClick={() => (live.some((l) => picked[l.id]) ? void save.mutate().catch(() => undefined) : toast.error(LOCATIONS.pickFirst))}
        >
          {one ? LOCATIONS.useThis : LOCATIONS.save}
        </Button>
      </div>
    </ResponsivePicker>
  );
}
