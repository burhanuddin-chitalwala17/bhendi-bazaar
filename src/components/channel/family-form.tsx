"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/forms/FormField";
import { useServerForm } from "@/hooks/core/useServerForm";
import { formatCurrency, paiseToRupees } from "@/lib/format";
import { familySettleSchema, type FamilySettleFormValues } from "@/lib/validation/schemas/family-settle.schema";
import type { FamilyPageDTO, FamilySettleResultDTO } from "@server/channels/channel-family.types";

import { channelsApiClient } from "./channelsApiClient";
import { FAMILY } from "./family-copy";
import { ListingImage } from "./listing-image";
import { SettleTypeQuestion } from "./settle-type-question";

type Answers = Record<string, Record<string, string>>;

/**
 * The family page's form (family-merge ux.md "Family page"): name, category, what the members share
 * and how they differ, and each member's SKU, price and stock. One request; the server plans again.
 */
export function FamilyForm({
  orgId,
  detail,
  categories,
  backHref,
}: {
  orgId: string;
  detail: FamilyPageDTO;
  categories: Array<{ id: string; name: string }>;
  backHref: string;
}) {
  const router = useRouter();
  const l = detail.label;
  const adding = detail.family !== null;
  const firstLocation = detail.locations[0]?.id;

  const form = useServerForm<FamilySettleFormValues>({
    schema: familySettleSchema as never,
    defaultValues: {
      listingIds: detail.members.map((m) => m.listingId),
      familyId: detail.family?.id,
      name: detail.name,
      description: detail.description,
      categoryId: detail.defaultCategoryId ?? undefined,
      removedAxes: [],
      answers: {},
      members: detail.members.map((m) => ({
        listingId: m.listingId,
        include: true,
        move: false,
        sku: m.product ? undefined : m.sku,
        price: m.product || m.pricePaise === null ? undefined : paiseToRupees(m.pricePaise),
        stock: m.product || !firstLocation ? [] : [{ locationId: firstLocation, quantity: m.quantity ?? 0 }],
      })),
    },
    submit: async (values) => (await channelsApiClient.settleFamily(orgId, values)).result,
    onSuccess: (outcome) => {
      const result = outcome as FamilySettleResultDTO;
      toast.success(adding ? FAMILY.added(result.familyName, result.members) : FAMILY.saved(result.familyName, result.members, result.axisWord));
      router.push(backHref.replace("tab=notLinked", "tab=linked"));
    },
  });
  const { register, setValue, watch, formState } = form;
  const errors = formState.errors as Record<string, { message?: string } | undefined>;

  const categoryId = watch("categoryId");
  const removed = watch("removedAxes") ?? [];
  const answers = (watch("answers") ?? {}) as Answers;
  const members = watch("members") ?? [];
  const typeKey = detail.family?.productType ?? (categoryId ? detail.typeOfCategory[categoryId] : undefined);
  const plan = typeKey ? detail.byType[typeKey] : undefined;
  const axes = useMemo(() => (plan?.axes ?? []).filter((a) => !removed.includes(a.key)), [plan, removed]);
  const included = members.filter((m) => m.include !== false).length;

  const answer = (who: string, fact: string, key: string | null) => {
    const next: Answers = { ...answers, [who]: { ...(answers[who] ?? {}) } };
    if (key) next[who][fact] = key;
    else delete next[who][fact];
    setValue("answers", next);
  };
  const setMember = (index: number, patch: Partial<(typeof members)[number]>) =>
    setValue(`members.${index}`, { ...members[index], ...patch } as never);

  const axisNames = axes.map((a) => a.label).join(" and ");
  // Two differences: members gather under the first, each group collapsing (ux.md "Many members").
  const groups = useMemo(() => {
    const all = detail.members.map((_, i) => i);
    const first = axes.length >= 2 ? axes[0].key : null;
    if (!first || !plan) return [{ name: "", indexes: all }];
    const byValue = new Map<string, number[]>();
    for (const i of all) {
      const name = plan.members.find((p) => p.listingId === detail.members[i].listingId)?.values[first]?.display ?? "—";
      byValue.set(name, [...(byValue.get(name) ?? []), i]);
    }
    return [...byValue.entries()].map(([name, indexes]) => ({ name, indexes }));
  }, [axes, plan, detail.members]);

  return (
    <form onSubmit={form.onSubmit} className="flex flex-col gap-5 pb-24 md:pb-6">
      {detail.more > 0 && (
        <p role="status" className="rounded-card border border-warning bg-warning/10 p-3 text-sm">
          {FAMILY.more(detail.members.length + detail.more, detail.members.length)}
        </p>
      )}

      <section className="flex flex-col gap-3 rounded-card border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">{FAMILY.family}</h2>
        <FormField id="family-name" label={FAMILY.name} required error={errors.name?.message}>
          <Input id="family-name" readOnly={adding} {...register("name")} />
        </FormField>
        {!adding && (
          <FormField id="family-description" label={FAMILY.description} error={errors.description?.message}>
            <Textarea id="family-description" rows={4} {...register("description")} />
          </FormField>
        )}
      </section>

      {!adding && (
        <section className="flex flex-col gap-3 rounded-card border bg-card p-4">
          {detail.type && detail.type.kind !== "none" && (
            <SettleTypeQuestion
              label={l}
              type={detail.type}
              categoryId={categoryId}
              message=""
              onCategory={(id) => setValue("categoryId", id, { shouldValidate: formState.isSubmitted })}
              onPark={() => undefined}
            />
          )}
          <FormField id="family-category" label={FAMILY.category} required error={errors.categoryId?.message}>
            <Select id="family-category" {...register("categoryId")}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          {categoryId && !typeKey && <p className="text-sm font-medium text-warning">{FAMILY.noType}</p>}
          {!categoryId && <p className="text-sm text-muted-foreground">{FAMILY.pickCategory}</p>}
        </section>
      )}

      {plan && axes.length > 0 && (
        <section className="flex flex-col gap-3 rounded-card border bg-card p-4">
          <p className="text-sm">{axes.some((a) => a.added) ? FAMILY.variesByMore(axisNames) : FAMILY.variesBy(axisNames)}</p>
          {axes.some((a) => a.added) && (
            <div className="flex flex-wrap gap-2">
              {axes.filter((a) => a.added).map((a) => (
                <Button key={a.key} type="button" variant="outline" size="sm" className="min-h-10" onClick={() => setValue("removedAxes", [...removed, a.key])}>
                  {FAMILY.removeAxis(a.label)}
                </Button>
              ))}
            </div>
          )}
          {(plan.shared.length > 0 || plan.sharedQuestions.length > 0) && (
            <>
              <h2 className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">{FAMILY.sharedBy(detail.members.length)}</h2>
              <p className="text-sm text-muted-foreground">{FAMILY.sharedHint}</p>
              <ul className="flex flex-col gap-1 text-sm">
                {plan.shared.map((f) => (
                  <li key={f.fact}>
                    {f.label} · <strong>{f.value}</strong>
                  </li>
                ))}
              </ul>
              {plan.sharedQuestions.map((q) => (
                <div key={q.fact} className="flex flex-col gap-2 rounded-card border border-warning bg-warning/10 p-3">
                  <p className="text-sm">{FAMILY.sharedQuestion(l, q.label, q.said)}</p>
                  <Chips options={q.options} chosen={answers["*"]?.[q.fact]} onChoose={(key) => answer("*", q.fact, key)} />
                </div>
              ))}
            </>
          )}
        </section>
      )}

      {detail.family && detail.family.members.length > 0 && (
        <section className="flex flex-col gap-2 rounded-card border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">{FAMILY.existingMembers(detail.family.memberCount)}</h2>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {detail.family.members.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">{FAMILY.members}</h2>
      </div>
      {errors.members?.message && (
        <p role="alert" className="rounded-card border border-destructive bg-destructive/10 p-3 text-sm">
          {errors.members.message}
        </p>
      )}
      {groups.map((group) => (
        <details key={group.name} open className="group flex flex-col gap-3">
          {group.name && (
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between py-2 text-sm font-semibold">
              {group.name} · {group.indexes.length}
            </summary>
          )}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {group.indexes.map((index) => {
          const m = detail.members[index];
          const state = members[index];
          const planned = plan?.members.find((p) => p.listingId === m.listingId);
          const heading = axes.map((a) => planned?.values[a.key]?.display).filter(Boolean).join(" · ");
          const asked = (planned?.questions ?? []).filter((q) => axes.some((a) => a.key === q.fact));
          return (
            <li key={m.listingId} className="flex flex-col gap-3 rounded-card border bg-card p-3">
              <div className="flex gap-3">
                <ListingImage url={m.imageUrl} title={m.title} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <strong className="text-sm">{heading || m.title || m.sku}</strong>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{m.title ?? m.sku}</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={state?.include === false ? "outline" : "default"}
                  aria-pressed={state?.include !== false}
                  className="min-h-10"
                  onClick={() => setMember(index, { include: state?.include === false })}
                >
                  {FAMILY.include}
                </Button>
              </div>
              {m.readFailed && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-warning">{FAMILY.readFailed(l)}</p>
                  <Button type="button" variant="outline" size="sm" className="min-h-10 self-start" onClick={() => router.refresh()}>
                    {FAMILY.tryAgain}
                  </Button>
                </div>
              )}
              {state?.include !== false &&
                asked.map((q) => {
                  const unit = plan?.axes.find((a) => a.key === q.fact)?.unit;
                  return (
                    <div key={q.fact} className="flex flex-col gap-2 rounded-card border border-warning bg-warning/10 p-3">
                      <p className="text-sm">{FAMILY.toConfirm(l, q.label, q.said)}</p>
                      {unit ? (
                        <FormField id={`answer-${m.listingId}-${q.fact}`} label={FAMILY.measureAnswer(q.label, unit)}>
                          <Input
                            id={`answer-${m.listingId}-${q.fact}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            value={answers[m.listingId]?.[q.fact] ?? ""}
                            onChange={(e) => answer(m.listingId, q.fact, e.target.value || null)}
                          />
                        </FormField>
                      ) : (
                        <Chips options={q.options} chosen={answers[m.listingId]?.[q.fact]} onChoose={(key) => answer(m.listingId, q.fact, key)} />
                      )}
                    </div>
                  );
                })}
              {m.product ? (
                <>
                  <p className="text-sm font-medium text-success">{FAMILY.alreadyProduct(m.product.name)}</p>
                  <p className="text-xs text-muted-foreground">
                    {FAMILY.joinsAsIs(m.product.sku, formatCurrency(m.product.pricePaise))}
                    {m.product.archived ? ` · ${FAMILY.archived}` : ""}
                  </p>
                  {m.product.family && state?.include !== false && (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-medium text-warning">{FAMILY.inOtherFamily(m.product.family.name)}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant={state?.move ? "default" : "outline"} aria-pressed={state?.move === true} className="min-h-10" onClick={() => setMember(index, { move: !state?.move })}>
                          {FAMILY.moveHere}
                        </Button>
                        <Button type="button" variant="outline" className="min-h-10" onClick={() => setMember(index, { include: false })}>
                          {FAMILY.leaveOut}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                state?.include !== false && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField id={`member-sku-${index}`} label={FAMILY.sku}>
                      <Input id={`member-sku-${index}`} {...register(`members.${index}.sku`)} />
                    </FormField>
                    <FormField id={`member-price-${index}`} label={FAMILY.price}>
                      <Input id={`member-price-${index}`} type="number" inputMode="decimal" step="0.01" min="0" {...register(`members.${index}.price`, { setValueAs: (v: string) => (v === "" || v === undefined ? undefined : Number(v)) })} />
                    </FormField>
                    {firstLocation && (
                      <div className="sm:col-span-2">
                        <FormField id={`member-qty-${index}`} label={FAMILY.quantity} hint={FAMILY.says(l, m.quantity)}>
                          <Input id={`member-qty-${index}`} type="number" inputMode="numeric" min="0" {...register(`members.${index}.stock.0.quantity`, { setValueAs: (v: string) => (v === "" || v === undefined ? 0 : Number(v)) })} />
                        </FormField>
                      </div>
                    )}
                  </div>
                )
              )}
            </li>
          );
        })}
      </ul>
        </details>
      ))}

      {errors.listingIds?.message && (
        <p role="alert" className="rounded-card border border-destructive bg-destructive/10 p-3 text-sm">
          {errors.listingIds.message}
        </p>
      )}
      {form.formError && (
        <p role="alert" className="rounded-card border border-destructive bg-destructive/10 p-3 text-sm">
          {form.formError}
        </p>
      )}
      <p className="text-center text-xs text-muted-foreground">{FAMILY.allOrNone}</p>
      <div className="fixed inset-x-0 bottom-tabbar z-10 border-t bg-card p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <Button type="submit" className="min-h-10 w-full md:w-auto" aria-busy={form.isSubmitting}>
          {form.isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {form.isSubmitting ? FAMILY.saving : adding ? FAMILY.add(included) : FAMILY.save(included)}
        </Button>
      </div>
    </form>
  );
}

function Chips({ options, chosen, onChoose }: { options: Array<{ key: string; label: string }>; chosen: string | undefined; onChoose: (key: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button
          key={o.key}
          type="button"
          size="sm"
          variant={chosen === o.key ? "default" : "outline"}
          aria-pressed={chosen === o.key}
          className="h-auto min-h-10 max-w-full whitespace-normal"
          onClick={() => onChoose(chosen === o.key ? null : o.key)}
        >
          <span className="line-clamp-2">{o.label}</span>
        </Button>
      ))}
    </div>
  );
}
