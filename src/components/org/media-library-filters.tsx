import { MediaAssetKind, MediaAssetSource } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { AutoSubmitForm } from "@/components/shared/forms/auto-submit-form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MEDIA_USAGE, type MediaLibraryFilters as Filters } from "@/lib/validation/schemas/media-library.schema";

const KIND_LABELS: Record<MediaAssetKind, string> = { IMAGE: "Photos", VIDEO_EMBED: "Videos" };
const SOURCE_LABELS: Record<MediaAssetSource, string> = { UPLOAD: "Uploaded", DERIVED: "Cropped or made", EMBED: "Video link" };
const USAGE_LABELS: Record<Filters["usage"], string> = { all: "Used or not", used: "In use", unused: "Not used" };

const toDateInput = (value: Date | undefined) => (value ? value.toISOString().slice(0, 10) : "");

/**
 * A plain GET form (media-library spec R6): the filters live in the URL, so the page is a link
 * anyone in the org can share. It applies as a filter is picked; the button is the fallback.
 */
export function MediaLibraryFilters({ filters }: { filters: Filters }) {
  return (
    <AutoSubmitForm className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex-1 text-sm sm:max-w-40">
        <span className="mb-1 block text-muted-foreground">Kind</span>
        <Select name="kind" defaultValue={filters.kind ?? ""}>
          <option value="">Photos and videos</option>
          {Object.values(MediaAssetKind).map((kind) => (
            <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>
          ))}
        </Select>
      </label>
      <label className="flex-1 text-sm sm:max-w-40">
        <span className="mb-1 block text-muted-foreground">Usage</span>
        <Select name="usage" defaultValue={filters.usage}>
          {MEDIA_USAGE.map((usage) => (
            <option key={usage} value={usage}>{USAGE_LABELS[usage]}</option>
          ))}
        </Select>
      </label>
      <label className="flex-1 text-sm sm:max-w-44">
        <span className="mb-1 block text-muted-foreground">Came from</span>
        <Select name="source" defaultValue={filters.source ?? ""}>
          <option value="">Anywhere</option>
          {Object.values(MediaAssetSource).map((source) => (
            <option key={source} value={source}>{SOURCE_LABELS[source]}</option>
          ))}
        </Select>
      </label>
      <label className="flex-1 text-sm sm:max-w-40">
        <span className="mb-1 block text-muted-foreground">From</span>
        <Input type="date" name="from" defaultValue={toDateInput(filters.from)} />
      </label>
      <label className="flex-1 text-sm sm:max-w-40">
        <span className="mb-1 block text-muted-foreground">To</span>
        <Input type="date" name="to" defaultValue={toDateInput(filters.to)} />
      </label>
      {filters.productId && <input type="hidden" name="productId" value={filters.productId} />}
      {filters.slot && <input type="hidden" name="slot" value={filters.slot} />}
      <Checkbox name="retired" value="1" label="Show retired" defaultChecked={filters.retired} />
      <Button type="submit" variant="outline" size="sm">
        Filter
      </Button>
    </AutoSubmitForm>
  );
}
