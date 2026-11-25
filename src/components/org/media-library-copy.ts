import type { MediaAssetDto, MediaTag } from "@server/catalog/media-library.types";

/** The media library's words: the grid and its sheet, the filters, the upload button, the takedown (ADR-0067). */
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export const MEDIA_GRID_COPY = {
  tags: "Tags",
  tagLabel: { PRODUCT: "Product", REFERENCE: "Reference" } as Record<MediaTag, string>,
  tagAdded: (tag: string) => `Added tag ${tag}`,
  tagRemoved: (tag: string) => `Removed tag ${tag}`,
  tagFailed: "Couldn't change the tag",
  noReferences: "No reference pictures yet. Add one when you improve a photo with AI.",
  sourceUpload: "Uploaded",
  sourceDerived: "Made from another item",
  sourceEmbed: "Video link",
  kindImage: "Photo",
  kindEmbed: "Video link",
  kindVideo: "Video",
  stateProcessing: "Processing",
  stateFailed: "Failed",
  posterRestored: "The video shows its own frame again",
  posterChanged: "Poster changed",
  cropped: "Cropped. The photo you started from is untouched.",
  retired: "Image retired",
  stillChecking: "Still checking where this image is used. Try again in a moment.",
  stillUsed: (where: string) => `This image is still used by ${where}. Remove it there first.`,
  confirmRetire: "Retire this image? It leaves the library now and its file is deleted after thirty days.",
  empty: "Nothing here yet. Photos you upload to a product, a banner or your storefront appear in this library.",
  itemCount: (total: number) => `${total} item${total === 1 ? "" : "s"}`,
  photoLabel: (width: number | string, height: number | string) => `Photo ${width} by ${height}`,
  useCount: (uses: number) => `${uses} use${uses === 1 ? "" : "s"}`,
  loadMoreNoun: "items",
  libraryName: "this library",
  videoTitle: "this video",
  changePoster: "Change poster",
  ownFrame: "Use the video's own frame",
  choosePoster: "Choose a poster",
  choosePosterHint: "The photograph that stands in for this video until it plays. Tap the current one to go back to the video's own frame.",
  size: "Size",
  file: "File",
  duration: "Duration",
  status: "Status",
  added: "Added",
  retiredOn: "Retired",
  takenDown: "Taken down by Bhendi Bazaar",
  usedBy: "Used by",
  looking: "Looking…",
  nowhere: "Nowhere. This can be retired.",
  derived: (count: number) => `${count} picture${count === 1 ? " was" : "s were"} made from this one.`,
  derivedKept: " It stays in storage for them even after it leaves the library.",
  improve: "Improve",
  crop: "Crop",
  retiring: "Retiring…",
  retire: "Retire",
  useProduct: "Product",
  useCategory: "Category",
  useStorefront: "Storefront",
  useStorefrontBanner: "Storefront banner",
  useHomeBanner: "Home banner",
  useVideoPoster: "Video",
  slot: (slot: string) => ` · ${slot} slot`,
} as const;

export const MEDIA_FILTERS_COPY = {
  tag: "Tag",
  allTags: "All tags",
  kind: "Kind",
  allKinds: "Photos and videos",
  usage: "Usage",
  usageAll: "Used or not",
  usageUsed: "In use",
  usageUnused: "Not used",
  source: "Came from",
  anySource: "Anywhere",
  when: "When",
  showRetired: "Show retired",
} as const;

/**
 * The Kind and Came from choices, keyed by the mirrored enum values so the Library page and the
 * picker (a client component, which cannot import the enums) read one list (picker-filters D2).
 */
const KIND_LABEL = { IMAGE: "Photos", VIDEO: "Videos", VIDEO_EMBED: "YouTube links" } as const satisfies Record<MediaAssetDto["kind"], string>;
const SOURCE_LABEL = { UPLOAD: "Uploaded", DERIVED: "Cropped or made", EMBED: "Video link" } as const satisfies Record<MediaAssetDto["source"], string>;

const optionsOf = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export const MEDIA_KIND_OPTIONS = optionsOf(KIND_LABEL);
export const MEDIA_SOURCE_OPTIONS = optionsOf(SOURCE_LABEL);

export const MEDIA_UPLOAD_COPY = {
  failed: "Upload failed",
  photos: (count: number) => plural(count, "photo"),
  videos: (count: number) => plural(count, "video"),
  and: " and ",
  refused: (names: string, reason: string | null | undefined, added: string) =>
    `Could not upload ${names} (${reason}).${added ? ` ${added} added.` : ""}`,
  alreadyHere: (reused: number) =>
    reused === 1 ? "That file is already in your library." : `All ${reused} files are already in your library.`,
  added: (added: string, reused: number) =>
    `${added} added${reused > 0 ? `; ${reused} ${reused === 1 ? "was" : "were"} already here` : ""}.`,
  uploadingMany: (done: number, total: number) => `Uploading ${done}/${total}…`,
  uploading: "Uploading…",
  upload: "Upload photos or a video",
} as const;

export const MEDIA_TAKEDOWN_COPY = {
  done: "Taken down. The shop can see why.",
  open: "Take down",
  title: "Take this image down",
  description: "It leaves the shop's library now, and the shop is shown the reason you give.",
  reason: "Why it is coming down",
  reasonPlaceholder: "What rule this breaks, in words the shop will understand.",
  cancel: "Cancel",
  submitting: "Taking it down…",
  submit: "Take it down",
} as const;

/** The viewer and the sheet's Download (viewer ux.md copy deck). */
export const MEDIA_VIEWER_COPY = {
  download: "Download",
  downloadFailed: "Couldn't download",
  downloadFailedHint: "Check your connection and try again.",
  tryAgain: "Try again",
  fileGone: "This file was deleted thirty days after it was retired.",
  notInLibrary: "This picture isn't in your library.",
  youtubeNoFile: "This video lives on YouTube, so there's no file to download.",
  openOnYouTube: "Open on YouTube",
  fullScreen: "View full screen",
  viewFullImage: "View full image",
  counter: (n: number, total: number) => `${n} of ${total}`,
  slideAlt: (n: number, total: number) => `Library item ${n} of ${total}`,
  thumbnail: (n: number) => `View item ${n}`,
  close: "Close",
  details: "Details",
  previous: "Previous",
  next: "Next",
  hint: "← → to move, Esc to close",
  lastOne: "That's the last one.",
  imageFailed: "Couldn't load this picture.",
  processingTitle: "Still processing",
  processingHint: "This video will play here once it's ready. It usually takes a minute or two.",
  failedVideo: (reason: string) => `This video couldn't be processed: ${reason}`,
} as const;

/** Selection mode and its bar (bulk-actions ux.md copy deck, Q16). */
export const MEDIA_BULK_COPY = {
  select: "Select",
  done: "Done",
  selectAll: (n: number) => `Select all ${n}`,
  clear: "Clear",
  none: "Tap pictures to select them",
  download: "Download",
  tag: "Tag",
  retire: "Retire",
  cancel: "Cancel",
  selectItem: (label: string) => `Select ${label}`,
  nothingSelected: "Select a picture first.",
  zipProgress: (done: number, total: number) => `Preparing your zip… ${done} of ${total} files`,
  zipDone: (n: number) => `Downloaded ${n} files`,
  zipLinks: (n: number) => `${n} YouTube link${n === 1 ? "" : "s"} left out. A link isn't a file.`,
  zipTooBig: (size: string, limit: string) => `That's ${size}, more than ${limit} at once`,
  zipTooBigHint: "Select fewer and download in two goes.",
  zipPartial: (ok: number, total: number) => `Downloaded ${ok} of ${total} files`,
  zipPartialFailed: (n: number) => `${n} couldn't be fetched.`,
  zipRetry: (n: number) => `Try those ${n} again`,
  zipNoneFetched: "Couldn't fetch any of these files. Try again later.",
  zipTooBigMidway: (limit: string) => `This selection is more than ${limit}`,
  zipRemoved: (n: number) => `${n} were removed and can't be downloaded.`,
  zipNotOurs: (n: number) => `${n} are no longer in your library.`,
  zipNothing: "Nothing to download",
  zipNothingHint: "YouTube links aren't files.",
  retireTitle: (n: number) => `Retire ${n} pictures?`,
  retireBody: "They leave the library now, and their files are deleted after thirty days.",
  retireSomeUsed: (m: number) => `${m} more are still in use, so they'll stay. Filter by Usage: In use to find them.`,
  retireConfirm: (n: number) => `Retire ${n}`,
  retireAllUsed: "None of these can be retired",
  retireAllUsedHint: (n: number) => `All ${n} are still in use. Take them off the products that use them first.`,
  retireDone: (n: number) => `Retired ${n} pictures`,
  retireTurnedUsed: (n: number) => `${n} turned out to be in use and stayed.`,
  alreadyRetired: (n: number) => `${n} were already retired.`,
  retiredOnlyDownload: "Retired pictures can only be downloaded.",
  tagTitle: (n: number) => `Tag ${n} photos`,
  tagNonPhotos: (n: number) => `${n} video${n === 1 ? "" : "s"} selected too. Videos don't take tags.`,
  tagAdd: "Add",
  tagRemove: "Remove",
  tagAdded: (n: number, tag: string) => `Tagged ${n} photos as ${tag}`,
  tagRemoved: (n: number, tag: string) => `Removed ${tag} from ${n} photos`,
  tagVideosLeftOut: (n: number) => `${n} video${n === 1 ? "" : "s"} left out (videos don't take tags)`,
  tagNoPhotos: "Only photos take tags. None of these are photos.",
  unreachable: "Couldn't reach the server. Nothing was changed.",
  unreachableShort: "Couldn't reach the server.",
  tryAgain: "Try again",
} as const;
