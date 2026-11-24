import type { MediaUsage } from "@/lib/validation/schemas/media-library.schema";

/** The library's filter fields as a form holds them, on the page or in the picker: "" is "any", the range is two day keys. */
export interface MediaFilterValue {
  tag: string;
  kind: string;
  usage: MediaUsage;
  source: string;
  from?: string;
  to?: string;
}
