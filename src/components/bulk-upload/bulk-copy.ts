/** The bulk wizards' words, beside `check-copy.ts` (Check and create) and SHEET_COPY (ADR-0067). */
export const BULK_IMPORT_COPY = {
  chooseSheet: "Choose the filled-in sheet first",
  checkFailed: "Could not check the sheet",
  uploadFailed: "Upload failed",
  filterByColumn: "Filter by column",
} as const;

export const BULK_CATEGORY_COPY = {
  missingFile: (name: string) => `Missing file "${name}"`,
  created: (n: number) => `✅ ${n} categories created`,
  viewCategories: "View categories",
  sheetStep: "1 · The filled-in sheet",
  sheetFormats: ".xlsx or .csv —",
  downloadSample: "download the sample",
  imagesStep: "2 · The hero images",
  imagesHintBefore: "A folder or individual files — write the folder in the sheet (",
  imagesExample: "abayas/hero.jpg",
  imagesHintAfter: ") when two rows share a filename.",
  chooseFolder: "Choose a folder",
  pickIndividually: "…or pick images individually",
  filesSelected: (n: number) => `${n} files selected`,
  problems: (n: number) => `${n} problem${n === 1 ? "" : "s"} — nothing was created`,
  sheet: "Sheet",
  row: (n: number) => `Row ${n}`,
  clean: (n: number) => `✓ Sheet is clean — ${n} categories`,
  under: (parent: string) => `under ${parent}`,
  uploading: "Uploading hero images…",
  creating: "Creating categories…",
  create: (n: number) => `Create ${n} categories`,
  checking: "Checking…",
  check: "Check the sheet",
} as const;

export const GET_THE_SHEET_COPY = {
  intro: "Which things do you sell? Tick them — your sheet gets one tab for each kind.",
  lastDownloaded: (date: string) => `Last downloaded ${date}. Our lists change, so download a fresh sheet each time.`,
  noLocation: "Add where your stock is kept first — the sheet needs a stock column for it.",
  addLocation: "Add location",
  search: "Search categories",
  yourSheet: "Your sheet",
  instructions: "Instructions",
  tabs: (n: number, names: string) => `${n} tab${n === 1 ? "" : "s"}: ${names}`,
  tryAgain: "Try again",
  download: "Download sheet",
} as const;

export const BULK_PRODUCT_COPY = {
  steps: ["Get the sheet", "Fill it", "Upload", "Check and create"] as const,
  step: (n: number, label: string) => `${n} · ${label}`,
  uploadingToast: (done: number, total: number) => `Uploading photos ${done}/${total}… keep this page open`,
  missingFile: (name: string) => `Missing file "${name}"`,
  haveSheet: "I already have a filled sheet",
  fillIt: "Fill the sheet on your laptop or phone, then come back.",
  filled: "I've filled it",
  downloadSheet: "Download sheet",
  viewProducts: "View products",
  yourSheet: "Your filled sheet (.xlsx or .csv)",
  freshSheet: "Download a fresh sheet",
  photosTitle: "Your photos — a folder keeps each product's photos apart",
  photosHintBefore: "Two products can both have a",
  photosExampleFile: "front.jpg",
  photosHintMiddle: "— write the folder in the sheet as",
  photosExamplePath: "emerald-abaya/front.jpg",
  photosHintAfter: ". A flat selection works too when every filename is different.",
  chooseFolder: "Choose a folder",
  pickIndividually: "…or pick photos individually",
  filesSelected: (n: number, withFolders: boolean) => `${n} files selected${withFolders ? ", with folders" : ""}`,
  uploading: (done: number, total: number) => `Uploading photos… ${done}/${total}`,
  creating: "Creating products…",
  check: "Check the sheet",
} as const;

export const SHEET_COPY = {
  REFUSED: "Tick at least one thing you sell, so the sheet has the right columns.",
  MAKING: "Making your sheet…",
  DONE: "Sheet downloaded. Open it, fill it, then come back here.",
  FAILED: "Couldn't make your sheet. Try again.",
} as const;
