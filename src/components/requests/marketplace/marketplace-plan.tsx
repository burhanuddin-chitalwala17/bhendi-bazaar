"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useMutation } from "@/hooks/core/useMutation";
import { formatTime } from "@/lib/format";
import type { PlanUnavailableDTO } from "@server/requests/request.types";
import { FIELD_SOLUTION, MARKETPLACE_KIND, MARKETPLACE_UNAVAILABLE, type MarketplacePlanDTO } from "@server/requests/marketplace/marketplace.types";
import { ROUTES } from "@server/shared/routes";
import { CHANNEL } from "@server/shared/channels";

import { adminRequestsApiClient } from "../adminRequestsApiClient";
import { REQUESTS_COPY as C } from "../requests-copy";
import type { RequirementPlanProps } from "../requirement-plans";

type Plan = MarketplacePlanDTO | PlanUnavailableDTO;

/**
 * A requirement's preview and its one action (setup-requests Q6, D7): the fix worked out, the steps
 * there to read, Apply. A decision kind offers Amazon's types to pick. Nothing is disabled (ADR-0053).
 */
export function MarketplacePlan({ id, kind, shopsWaiting }: RequirementPlanProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<string>("");
  const [typed, setTyped] = useState<string>("");
  const [confirmNotNow, setConfirmNotNow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    setFailed(false);
    adminRequestsApiClient
      .plan<MarketplacePlanDTO>(id)
      .then((p) => {
        setPlan(p);
        if ("kind" in p && p.kind === MARKETPLACE_KIND.CATEGORY) setPicked(p.options.find((o) => o.exact)?.theirCategory ?? "");
      })
      .catch(() => setFailed(true));
  };
  useEffect(load, [id]);

  const act = useMutation((body: Parameters<typeof adminRequestsApiClient.act>[1]) => adminRequestsApiClient.act<MarketplacePlanDTO>(id, body), {
    showToast: false,
    onError: (error) => toast.error(error.message),
  });

  const apply = async () => {
    if (!plan) return;
    const category = typed.trim() || picked;
    if ("kind" in plan && plan.kind === MARKETPLACE_KIND.CATEGORY && !category) return setNotice(C.pickFirst);
    if ("unavailable" in plan && (kind !== MARKETPLACE_KIND.CATEGORY || !typed.trim())) return setNotice(kind === MARKETPLACE_KIND.CATEGORY ? C.pickFirst : C.fieldsNeedAmazon);
    const outcome = await act.mutate({ action: "apply", hash: "hash" in plan ? plan.hash : "", choice: category ? { theirCategory: category } : {} }).catch(() => null);
    if (!outcome) return;
    if ("stale" in outcome) {
      setPlan(outcome.stale);
      return setNotice(C.stale);
    }
    toast.success(C.applied(shopsWaiting));
    router.refresh();
  };

  const notNow = async () => {
    if (!confirmNotNow) return setConfirmNotNow(true);
    await act.mutate({ action: "not_now" }).catch(() => null);
    router.refresh();
  };

  if (failed) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-card bg-destructive/10 p-4 text-small">
        <p>{C.unreachable}</p>
        <Button variant="outline" size="sm" className="min-h-10" onClick={load}>{C.tryAgain}</Button>
      </div>
    );
  }
  if (!plan) {
    return (
      <p className="flex items-center gap-2 text-small text-muted-foreground">
        <Spinner /> {C.reading("")}
      </p>
    );
  }

  const unavailable = "unavailable" in plan ? plan.unavailable : null;
  return (
    <section className="flex flex-col gap-4">
      {unavailable && (
        <div className="flex flex-col items-start gap-2 rounded-card bg-warning/10 p-4 text-small">
          <p>{unavailable === MARKETPLACE_UNAVAILABLE.NOT_CONNECTED ? C.notConnected : C.unreachable}</p>
          {unavailable === MARKETPLACE_UNAVAILABLE.NOT_CONNECTED ? (
            <Button asChild variant="outline" size="sm" className="min-h-10"><Link href={ROUTES.admin.channels}>{C.openRegister}</Link></Button>
          ) : (
            <Button variant="outline" size="sm" className="min-h-10" onClick={load}>{C.tryAgain}</Button>
          )}
        </div>
      )}
      {"readAt" in plan && <p className="text-caption text-muted-foreground">{C.readThrough("Amazon", formatTime(plan.readAt))}</p>}
      {notice && <p className="rounded-card bg-warning/10 p-3 text-small">{notice}</p>}

      {"kind" in plan && plan.kind === MARKETPLACE_KIND.FIELDS && (
        <>
          <p className="text-small">{C.fieldsIntro(plan.productTypes.map((t) => t.label).join(", "))}</p>
          <ul className="flex flex-col gap-2">
            {plan.fields.map((f) => (
              <li key={f.attribute} className="flex flex-col gap-1 rounded-card border bg-card p-3">
                <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">{`Amazon: ${f.attribute}`}</p>
                <p className="font-medium">{f.factLabel ?? f.label}</p>
                <p className={f.solution === FIELD_SOLUTION.NOT_POSSIBLE ? "text-small text-destructive" : "text-small text-muted-foreground"}>
                  {C.solution[f.solution]}
                  {f.source ? ` · ${C.source[f.source] ?? f.source}` : ""}
                  {f.constant ? ` · "${f.constant}"` : ""}
                </p>
                {f.solution === FIELD_SOLUTION.MAP_PARTS && (
                  <Button asChild variant="outline" size="sm" className="min-h-10 self-start">
                    <Link href={ROUTES.admin.channelType(CHANNEL.AMAZON, plan.theirCategory)}>{C.openFieldMaps}</Link>
                  </Button>
                )}
                {f.allowed.length > 0 && <p className="break-words text-caption text-muted-foreground">{f.allowed.slice(0, 8).join(" · ")}{f.allowed.length > 8 ? ` · +${f.allowed.length - 8}` : ""}</p>}
              </li>
            ))}
          </ul>
          <details className="border-t pt-2 text-small text-muted-foreground">
            <summary className="cursor-pointer font-semibold text-foreground">{C.whatApplyDoes}</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {plan.fields.filter((f) => f.solution !== FIELD_SOLUTION.NOT_POSSIBLE && f.solution !== FIELD_SOLUTION.MAP_PARTS).map((f) => (
                <li key={f.attribute}>
                  {f.solution === FIELD_SOLUTION.REUSE ? C.step.reuse(f.attribute, f.factLabel ?? "")
                    : f.solution === FIELD_SOLUTION.ADD ? C.step.add(f.attribute, f.factLabel ?? "", plan.productTypes.map((t) => t.label).join(", "))
                    : f.solution === FIELD_SOLUTION.FROM_PRODUCT ? C.step.fromProduct(f.attribute, C.source[f.source ?? ""] ?? "")
                    : C.step.fixed(f.attribute, f.constant ?? "")}
                </li>
              ))}
            </ol>
          </details>
          <Button className="min-h-10 w-full" pending={act.isLoading} onClick={apply}>{C.applyFields(plan.fields.filter((f) => f.solution !== FIELD_SOLUTION.NOT_POSSIBLE && f.solution !== FIELD_SOLUTION.MAP_PARTS).length)}</Button>
        </>
      )}

      {("kind" in plan ? plan.kind === MARKETPLACE_KIND.CATEGORY : kind === MARKETPLACE_KIND.CATEGORY) && (
        <>
          {"kind" in plan && plan.kind === MARKETPLACE_KIND.CATEGORY && (
            <div role="radiogroup" className="flex flex-col gap-2">
              {plan.options.map((o) => (
                <Button
                  key={o.theirCategory}
                  type="button"
                  role="radio"
                  aria-checked={picked === o.theirCategory}
                  variant={picked === o.theirCategory ? "default" : "outline"}
                  className="h-auto min-h-12 justify-start whitespace-normal text-left"
                  onClick={() => { setPicked(o.theirCategory); setTyped(""); setNotice(null); }}
                >
                  <span className="flex flex-col"><span className="font-semibold">{o.theirCategory}</span><span className="text-caption">{o.label}</span></span>
                </Button>
              ))}
            </div>
          )}
          <label className="flex flex-col gap-1 text-small" htmlFor={`type-${id}`}>
            {C.orType}
            <Input id={`type-${id}`} value={typed} onChange={(e) => { setTyped(e.target.value); setNotice(null); }} placeholder="TOTE_BAG" />
          </label>
          <Button className="min-h-10 w-full" pending={act.isLoading} onClick={apply}>{C.applyType(typed.trim() || picked || "…")}</Button>
        </>
      )}

      {confirmNotNow ? (
        <div className="flex flex-col gap-2 rounded-card bg-warning/10 p-3 text-small">
          <p className="font-semibold">{C.notNowConfirm}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="min-h-10" pending={act.isLoading} onClick={notNow}>{C.notNow}</Button>
            <Button size="sm" variant="outline" className="min-h-10" onClick={() => setConfirmNotNow(false)}>{C.keepIt}</Button>
          </div>
        </div>
      ) : (
        <Button variant="link" className="min-h-10 self-start p-0" onClick={notNow}>{C.notNow}</Button>
      )}
    </section>
  );
}
