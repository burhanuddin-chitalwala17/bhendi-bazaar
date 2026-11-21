// What the two bake-offs share (image-enhancement trd D10, generation-foundation trd D10): reading a
// flag, escaping text into the page, and picking a shop's newest photographs.
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { parseMediaLibraryFilters } from "@/lib/validation/schemas/media-library.schema";

/** Where a bake-off's output sits: beside the proposals, in a prefix no library lists. */
export const BAKEOFF_PREFIX = "bakeoff/";
export const DEFAULT_LIMIT = 20;
/** A ceiling, because every photograph past this one is a bill and the answer is legible long before. */
export const MAX_LIMIT = 100;

export function flag(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

export const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The limit flag, bounded and checked. */
export function limitFlag(): number {
  const limit = Math.min(MAX_LIMIT, Number(flag("limit") ?? DEFAULT_LIMIT));
  if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit must be a whole number of photographs.");
  return limit;
}

/** The org's newest ready photographs, paging the library until there are enough or it runs out. */
export async function newestPhotographs(orgId: string, limit: number): Promise<string[]> {
  const ids: string[] = [];
  for (let pageNumber = 1; ids.length < limit; pageNumber += 1) {
    const { assets, pagination } = await mediaAssetService.listLibrary(
      orgId,
      parseMediaLibraryFilters({ kind: "IMAGE", page: String(pageNumber) }),
    );
    for (const asset of assets) {
      if (asset.state === "READY" && ids.length < limit) ids.push(asset.id);
    }
    if (pageNumber >= pagination.totalPages) break;
  }
  return ids;
}
