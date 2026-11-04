"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@/hooks/core/useMutation";
import { formatDate } from "@/lib/format";
import type { ChannelTypeMapping } from "@server/listing/channel-map.types";
import type { Channel } from "@server/shared/channels";
import type { ChannelTypeChangeInput } from "@/lib/validation/schemas/channel-mapping.schema";

import { channelsApiClient } from "./channelsApiClient";
import { TYPES_EDITOR } from "./channel-copy";
import { TYPES_EDITOR_SAVE_COPY } from "@/components/channel/channel-copy";

const SAVE_FAILED = TYPES_EDITOR_SAVE_COPY.failed;
const day = (iso: string) => formatDate(iso, { day: "numeric", month: "short", year: "numeric" });

/**
 * Which marketplace types each of our types is read from, and the one it publishes to
 * (marketplace-facts Q26, ux.md "Channel register: types"). Nothing here is disabled.
 */
export function ChannelTypesEditor({
  channel,
  label,
  types,
  suggestions,
}: {
  channel: Channel;
  label: string;
  types: ChannelTypeMapping[];
  suggestions: string[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const change = useMutation((body: ChannelTypeChangeInput & { typeName: string }) => {
    const { typeName: _typeName, ...payload } = body;
    return channelsApiClient.changeChannelType(payload);
  }, {
    showToast: false,
    onError: (error) => toast.error(error.message || SAVE_FAILED),
  });

  const run = (body: ChannelTypeChangeInput, typeName: string, draftKey?: string) =>
    change
      .mutate({ ...body, typeName })
      .then(() => {
        toast.success(TYPES_EDITOR.saved(label, typeName));
        if (draftKey) setDrafts((d) => ({ ...d, [draftKey]: "" }));
        router.refresh();
      })
      .catch(() => undefined);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Types on {label}</h2>
        <p className="text-sm text-muted-foreground">
          Which {label} types each of our types is read from when filling a product, and the one it publishes to.
        </p>
      </div>
      <datalist id={`types-${channel}`}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <ul className="divide-y rounded-card border bg-card">
        {types.map((t) => {
          const key = `${t.productType}:${t.kind ?? "*"}`;
          const name = t.kind ? `${t.typeLabel} · ${t.kind}` : t.typeLabel;
          return (
            <li key={key} className="flex flex-col gap-3 p-4">
              <p className="font-medium">{name}</p>
              {t.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{`${name} has no ${label} type yet.`}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {t.rows.map((r) => (
                    <li key={r.id} className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
                      <span>
                        {r.theirLabel ?? r.theirCategory}
                        {r.publishes && <span className="font-medium text-success"> (publishes here)</span>}
                        <span className="text-muted-foreground"> · checked {day(r.checkedOn)}</span>
                      </span>
                      <span className="flex gap-2">
                        {!r.publishes && (
                          <Button size="sm" variant="outline" onClick={() => void run({ action: "publish", id: r.id }, name)}>
                            {TYPES_EDITOR.publishesHere}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void run({ action: "remove", id: r.id, typeLabel: name }, name)}
                        >
                          {TYPES_EDITOR.remove}
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="flex flex-col gap-2 md:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = (drafts[key] ?? "").trim();
                  if (!value) return toast.error(TYPES_EDITOR.nameIt(label));
                  void run({ action: "add", channel, productType: t.productType, kind: t.kind, theirCategory: value }, name, key);
                }}
              >
                <Input
                  aria-label={TYPES_EDITOR.typeFor(label, name)}
                  list={`types-${channel}`}
                  placeholder={t.rows.length === 0 ? TYPES_EDITOR.add(label) : TYPES_EDITOR.another(label)}
                  value={drafts[key] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                />
                <Button type="submit" variant="outline" className="min-h-10">
                  {t.rows.length === 0 ? `Add an ${label} type` : "Add"}
                </Button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
