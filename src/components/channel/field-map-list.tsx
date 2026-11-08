"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { FIELD_SOURCE } from "@server/listing/field-map.types";
import { FIELD_REQUIREMENT } from "@server/listing/channel-catalogue.types";
import type { AdminFieldMapsDTO, AdminFieldRowDTO } from "@server/listing/admin.field-map.types";
import type { Channel } from "@server/shared/channels";
import { FIELD_MAP_COPY } from "./field-map-copy";
import { FieldMapForm } from "./field-map-form";

/**
 * Every field of one channel type and where its value comes from (listing-model/field-maps ux.md): required
 * first, searchable, a row opening its edit in place. Rows on a phone and wider screens alike: each row
 * holds an edit form, which a table cell cannot.
 */
export function FieldMapList({ view }: { view: AdminFieldMapsDTO }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const words = query.trim().toLowerCase();
  const rows = words ? view.rows.filter((r) => `${r.label} ${r.field}`.toLowerCase().includes(words)) : view.rows;
  const attributeLabel = (k: string) => view.choices.attributes.find((a) => a.key === k)?.label ?? k;

  return (
    <div className="space-y-3">
      <Input aria-label={FIELD_MAP_COPY.search} placeholder={FIELD_MAP_COPY.search} value={query} onChange={(e) => setQuery(e.target.value)} />
      {rows.length === 0 ? (
        <p className="text-small text-muted-foreground">{FIELD_MAP_COPY.noMatch}</p>
      ) : (
        <Card className="py-0">
          <ul className="divide-y">
            {rows.map((row, i) => (
              <FieldRow key={`${row.field}:${i}`} row={row} view={view} attributeLabel={attributeLabel} open={open} setOpen={setOpen} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

interface FieldRowProps {
  row: AdminFieldRowDTO;
  view: AdminFieldMapsDTO;
  attributeLabel: (k: string) => string;
  open: string | null;
  setOpen: (key: string | null) => void;
}

function FieldRow({ row, view, attributeLabel, open, setOpen }: FieldRowProps) {
  const mapped = row.maps.length > 0;
  const editing = (path: string, bbType = "") => open === `${row.field}::${path}::${bbType}`;
  const close = () => setOpen(null);

  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 font-medium">{row.label}</p>
        <StatusBadge tone={row.requirement === FIELD_REQUIREMENT.REQUIRED ? "info" : "neutral"}>{FIELD_MAP_COPY.requirement[row.requirement] ?? row.requirement}</StatusBadge>
        {row.addedOn && <StatusBadge tone="warning">{FIELD_MAP_COPY.addedOn(row.addedOn)}</StatusBadge>}
      </div>

      {!mapped && (row.adapterFills
        ? <p className="text-small text-muted-foreground">{FIELD_MAP_COPY.filledBySystem}</p>
        : <p className="text-small text-warning">{FIELD_MAP_COPY.notMapped}</p>)}

      {row.maps.map((m) => (
        <div key={`${m.fieldPath}:${m.bbType}`} className="space-y-1">
          <p className="text-small">
            {FIELD_MAP_COPY.sourceLine(m.source, m.key, m.constant, attributeLabel)}
            {m.unitTarget && <span className="text-muted-foreground"> · {FIELD_MAP_COPY.unit(m.unitTarget)}</span>}
            {m.fieldPath !== row.field && <span className="text-muted-foreground"> · {FIELD_MAP_COPY.part(m.fieldPath)}</span>}
            {m.bbType && <span className="text-muted-foreground"> · {FIELD_MAP_COPY.forType(m.bbType)}</span>}
          </p>
          <p className="text-small text-muted-foreground">{m.reason}</p>
          <p className="text-caption text-muted-foreground">{FIELD_MAP_COPY.checked(m.checkedSource, m.checkedOn)}</p>
          {m.unpaired.length > 0 && m.source !== FIELD_SOURCE.DEVELOPER && (
            <p className="text-small text-warning">{FIELD_MAP_COPY.unpaired(m.unpaired.length, view.channelLabel)}</p>
          )}
          {m.waiting && <p className="text-small text-warning">{FIELD_MAP_COPY.waiting}</p>}
          {editing(m.fieldPath, m.bbType) ? (
            <FieldMapForm channel={view.channel as Channel} channelType={view.typeKey} typeLabel={view.typeLabel} fieldPath={m.fieldPath} map={m} choices={view.choices} onDone={close} />
          ) : (
            <Button variant="outline" size="sm" className="min-h-10" onClick={() => setOpen(`${row.field}::${m.fieldPath}::${m.bbType}`)}>
              {m.unpaired.length > 0 ? FIELD_MAP_COPY.pairThem : FIELD_MAP_COPY.change}
            </Button>
          )}
        </div>
      ))}

      {!mapped && !row.adapterFills && (editing(row.field) ? (
        <FieldMapForm channel={view.channel as Channel} channelType={view.typeKey} typeLabel={view.typeLabel} fieldPath={row.field} map={null} choices={view.choices} onDone={close} />
      ) : (
        <Button variant="outline" size="sm" className="min-h-10" onClick={() => setOpen(`${row.field}::${row.field}::`)}>{FIELD_MAP_COPY.map}</Button>
      ))}
    </li>
  );
}
