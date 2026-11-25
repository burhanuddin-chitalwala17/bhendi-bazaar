"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SelectionBar } from "@/components/shared/selection-bar";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { ResponsivePicker } from "@/components/shared/overlays/responsive-picker";
import { useMutation } from "@/hooks/core/useMutation";
import { MEDIA_TAGS, type MediaAssetDto, type MediaTag } from "@server/catalog/media-library.types";
import { orgMediaApiClient } from "./orgMediaApiClient";
import { useLibraryZip } from "./useLibraryZip";
import {
  mergeOutcomes,
  planRetire,
  planTag,
  retireNotice,
  sendInBatches,
  tagNotice,
  zipNotice,
  type BulkNotice,
} from "./library-bulk";
import { MEDIA_BULK_COPY as C, MEDIA_GRID_COPY } from "./media-library-copy";

interface MediaLibrarySelectionBarProps {
  orgId: string;
  orgCode: string | null;
  /** The loaded items that are ticked, in grid order. */
  picked: MediaAssetDto[];
  onClear: () => void;
  /** These left the library: the grid drops them, and the selection with them (trd D8). */
  onRetired: (ids: string[]) => void;
}

function say(notice: BulkNotice, retry?: (ids: string[]) => void) {
  const action = notice.retry && retry ? { label: notice.retry.label, onClick: () => retry(notice.retry!.ids) } : undefined;
  toast[notice.tone](notice.title, { description: notice.description, action });
}

type TagTarget = { ids: string[]; videos: number; retired: number };
type TagChoice = { ids: string[]; tag: MediaTag; on: boolean };

/** The bar under a Library selection: Download, Tag and Retire, each said back as one toast (bulk-actions R3–R6). */
export function MediaLibrarySelectionBar({ orgId, orgCode, picked, onClear, onRetired }: MediaLibrarySelectionBarProps) {
  const router = useRouter();
  const zip = useLibraryZip(orgId, orgCode);
  const [retiring, setRetiring] = useState<{ ids: string[]; inUse: number; alreadyRetired: number } | null>(null);
  const [retireFailed, setRetireFailed] = useState(false);
  const [tagging, setTagging] = useState<TagTarget | null>(null);
  const [tagChoice, setTagChoice] = useState<TagChoice | null>(null);

  const download = async (ids: string[]) => {
    if (ids.length === 0) return say({ tone: "error", title: C.nothingSelected });
    const notice = zipNotice(await zip.download(ids), ids);
    if (notice) say(notice, (again) => void download(again));
  };

  // Batches never throw: what landed before a failure is still said (Q10).
  const retireMutation = useMutation(
    (ids: string[]) => sendInBatches(ids, (chunk) => orgMediaApiClient.retireMany(orgId, chunk)),
    { showToast: false },
  );
  const confirmRetire = async () => {
    if (!retiring) return;
    setRetireFailed(false);
    const { results, failure } = await retireMutation.mutate(retiring.ids);
    const outcome = mergeOutcomes(results);
    if (!outcome) return setRetireFailed(true);
    say(retireNotice(outcome, retiring.alreadyRetired));
    if (failure) toast.error(C.unreachableShort);
    setRetiring(null);
    onRetired(outcome.retired);
    router.refresh();
  };

  const tagMutation = useMutation(
    ({ ids, tag, on }: TagChoice) => sendInBatches(ids, (chunk) => orgMediaApiClient.setTagMany(orgId, chunk, tag, on)),
    { showToast: false },
  );
  const applyTag = async (target: TagTarget, tag: MediaTag, on: boolean) => {
    const choice = { ids: target.ids, tag, on };
    setTagChoice(choice);
    const { results, failure } = await tagMutation.mutate(choice).finally(() => setTagChoice(null));
    const outcome = mergeOutcomes(results);
    if (!outcome) {
      toast.error(C.unreachable, { action: { label: C.tryAgain, onClick: () => void applyTag(target, tag, on) } });
      return;
    }
    say(tagNotice(outcome, { on, tag: MEDIA_GRID_COPY.tagLabel[tag], videos: target.videos, retired: target.retired }));
    if (failure) toast.error(C.unreachableShort);
    setTagging(null);
    router.refresh();
  };

  const onRetire = () => {
    const plan = planRetire(picked);
    if (plan.kind === "refused") return say(plan.notice);
    setRetireFailed(false);
    setRetiring(plan);
  };
  const onTag = () => {
    const plan = planTag(picked);
    if (plan.kind === "refused") return say(plan.notice);
    setTagging(plan);
  };

  const ids = picked.map((asset) => asset.id);

  return (
    <>
      <SelectionBar
        count={picked.length}
        hint={C.none}
        onClear={onClear}
        busy={
          zip.progress
            ? {
                label: C.zipProgress(zip.progress.done, zip.progress.total),
                done: zip.progress.done,
                total: zip.progress.total,
                cancel: { label: C.cancel, onClick: zip.cancel },
              }
            : undefined
        }
        actions={[
          { label: C.download, onClick: () => void download(ids) },
          {
            label: C.tag,
            onClick: onTag,
            pending: tagMutation.isLoading,
            // The bar's own button is the picker's trigger, so the popover anchors to it from md.
            wrap: (button) => (
              <ResponsivePicker
                open={tagging !== null}
                onOpenChange={(open) => !open && setTagging(null)}
                trigger={button}
                title={C.tagTitle(tagging?.ids.length ?? 0)}
              >
                {/* In the body, not the picker's description, which the popover form leaves out. */}
                {tagging && tagging.videos > 0 && <p className="text-small text-muted-foreground">{C.tagNonPhotos(tagging.videos)}</p>}
                {tagging && (
                  <ul className="space-y-2">
                    {MEDIA_TAGS.map((tag) => (
                      <li key={tag} role="group" aria-label={MEDIA_GRID_COPY.tagLabel[tag]} className="flex items-center gap-2">
                        <span className="flex-1 text-body">{MEDIA_GRID_COPY.tagLabel[tag]}</span>
                        {[true, false].map((on) => (
                          <Button
                            key={String(on)}
                            type="button"
                            variant={on ? "default" : "outline"}
                            size="sm"
                            pending={tagChoice?.tag === tag && tagChoice.on === on}
                            onClick={() => void applyTag(tagging, tag, on)}
                          >
                            {on ? C.tagAdd : C.tagRemove}
                          </Button>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </ResponsivePicker>
            ),
          },
          { label: C.retire, onClick: onRetire, pending: retireMutation.isLoading },
        ]}
      />

      <FormDialog
        open={retiring !== null}
        onOpenChange={(open) => !open && setRetiring(null)}
        title={C.retireTitle(retiring?.ids.length ?? 0)}
        description={C.retireBody}
      >
        {retiring && (
          <div className="space-y-4">
            {retiring.inUse > 0 && <p className="text-small text-muted-foreground">{C.retireSomeUsed(retiring.inUse)}</p>}
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              size="lg"
              pending={retireMutation.isLoading}
              onClick={() => void confirmRetire()}
            >
              {C.retireConfirm(retiring.ids.length)}
            </Button>
            {retireFailed && (
              <p role="alert" className="text-small text-destructive">
                {C.unreachable}
              </p>
            )}
          </div>
        )}
      </FormDialog>
    </>
  );
}
