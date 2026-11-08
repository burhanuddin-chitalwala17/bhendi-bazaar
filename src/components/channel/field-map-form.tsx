"use client";

import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/shared/forms/FormField";
import { useServerForm } from "@/hooks/core/useServerForm";
import { channelsApiClient } from "@/components/channel/channelsApiClient";
import { fieldMapSaveSchema, type FieldMapSaveInput } from "@/lib/validation/schemas/field-map.schema";
import { FIELD_SOURCE, FIELD_SOURCES, type FieldSource } from "@server/listing/field-map.types";
import type { AdminFieldMapDTO, FieldMapChoicesDTO } from "@server/listing/admin.field-map.types";
import type { Channel } from "@server/shared/channels";
import { CORE_LABELS, FIELD_MAP_COPY, RULE_LABELS } from "./field-map-copy";

interface FieldMapFormProps {
  channel: Channel;
  channelType: string;
  typeLabel: string;
  fieldPath: string;
  map: AdminFieldMapDTO | null;
  choices: FieldMapChoicesDTO;
  onDone: () => void;
}

/**
 * Changing where one channel field's value comes from, and pairing the answers it has no word for
 * (listing-model/field-maps ux.md journey 2). No confirm step (Q4); the save is the whole map.
 */
export function FieldMapForm({ channel, channelType, typeLabel, fieldPath, map, choices, onDone }: FieldMapFormProps) {
  const router = useRouter();
  const id = `fm-${`${fieldPath}-${map?.bbType ?? ""}`.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const unpaired = map?.unpaired ?? [];
  const { register, watch, onSubmit, formError, isSubmitting, formState: { errors } } = useServerForm<FieldMapSaveInput>({
    schema: fieldMapSaveSchema,
    submit: (data) => channelsApiClient.saveFieldMap(data),
    successMessage: FIELD_MAP_COPY.saved(typeLabel),
    fallbackMessage: FIELD_MAP_COPY.saveFailed,
    onSuccess: () => {
      onDone();
      router.refresh();
    },
    defaultValues: {
      channel, channelType, fieldPath, bbType: map?.bbType ?? "",
      source: (map?.source as FieldSource | undefined) ?? FIELD_SOURCE.ATTRIBUTE,
      key: map?.key ?? null, constant: map?.constant ?? null, unitTarget: map?.unitTarget ?? null,
      reason: map?.reason ?? "", values: map?.values ?? {},
    },
  });
  const source = watch("source");
  const keys = source === FIELD_SOURCE.ATTRIBUTE || source === FIELD_SOURCE.CONSTANT
    ? choices.attributes.map((a) => ({ key: a.key, label: a.planned ? FIELD_MAP_COPY.planned(a.label) : a.label }))
    : source === FIELD_SOURCE.RULE ? choices.rules.map((k) => ({ key: k, label: RULE_LABELS[k] ?? k }))
    : source === FIELD_SOURCE.CORE ? choices.core.map((k) => ({ key: k, label: CORE_LABELS[k] ?? k }))
    : source === FIELD_SOURCE.SHOP ? choices.shop.map((k) => ({ key: k, label: k })) : [];
  const allowed = map?.allowed ?? [];
  const valueErrors = errors.values as Record<string, { message?: string }> | undefined;

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-card border bg-muted/30 p-4">
      <FormField id={`${id}-source`} label={FIELD_MAP_COPY.fields.source} error={errors.source?.message}>
        <Select id={`${id}-source`} {...register("source")}>
          {FIELD_SOURCES.map((s) => <option key={s} value={s}>{FIELD_MAP_COPY.sources[s]}</option>)}
        </Select>
      </FormField>
      {keys.length > 0 && (
        <FormField id={`${id}-key`} label={FIELD_MAP_COPY.fields.key} error={errors.key?.message}>
          <Select id={`${id}-key`} {...register("key", { setValueAs: (v) => (v === "" ? null : v) })}>
            <option value="">{FIELD_MAP_COPY.pick}</option>
            {keys.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </Select>
        </FormField>
      )}
      {source === FIELD_SOURCE.CONSTANT && (
        <FormField id={`${id}-constant`} label={FIELD_MAP_COPY.fields.constant} error={errors.constant?.message}>
          <Input id={`${id}-constant`} autoComplete="off" {...register("constant", { setValueAs: (v) => (v === "" ? null : v) })} />
        </FormField>
      )}
      <FormField id={`${id}-unit`} label={FIELD_MAP_COPY.fields.unit} error={errors.unitTarget?.message}>
        <Input id={`${id}-unit`} autoComplete="off" {...register("unitTarget", { setValueAs: (v) => (v === "" ? null : v) })} />
      </FormField>
      {unpaired.map((o) => (
        <FormField key={o.optionKey} id={`${id}-pair-${o.optionKey}`} label={FIELD_MAP_COPY.fields.pair(o.label)} error={valueErrors?.[o.optionKey]?.message}>
          {allowed.length > 0 ? (
            <Select id={`${id}-pair-${o.optionKey}`} {...register(`values.${o.optionKey}`)}>
              <option value="">{FIELD_MAP_COPY.noPair}</option>
              {allowed.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          ) : (
            <Input id={`${id}-pair-${o.optionKey}`} autoComplete="off" {...register(`values.${o.optionKey}`)} />
          )}
        </FormField>
      ))}
      <FormField id={`${id}-reason`} label={FIELD_MAP_COPY.fields.reason} error={errors.reason?.message}>
        <Input id={`${id}-reason`} autoComplete="off" {...register("reason")} />
      </FormField>
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-10" pending={isSubmitting}>{FIELD_MAP_COPY.save}</Button>
        <Button type="button" variant="ghost" className="min-h-10" onClick={onDone}>{FIELD_MAP_COPY.cancel}</Button>
      </div>
    </form>
  );
}
