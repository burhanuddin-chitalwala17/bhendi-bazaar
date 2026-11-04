import { formatCount } from "@/lib/format";

/** Shop details copy, exactly as ux.md signs it off (org-profile Copy deck, state matrix). */
export const SHOP_DETAILS_COPY = {
  preview: "Preview",
  title: "Shop details",
  help: "Your shop's facts. Buyers see the top part; only we see the bottom part.",
  buyersPart: "Buyers see this — on your shop page",
  essentialsHeader: "Start with these three",
  optionalHeader: "Add more to your shop page",
  firstUse: "Start with these three. Everything else is optional.",
  empty: "Your shop page shows the basics. Add more whenever you like.",
  save: "Save",
  discard: "Discard",
  unsaved: "Unsaved changes",
  savedAll: "All changes saved.",
  notAllSaved: "Not everything saved. The section that didn't says why.",
  stillSaving: "Still saving…",
  seeAsBuyer: "See as a buyer",
  tryAgain: "Try again",
  loadLatest: "Load latest",
  saved: "Saved. Buyers see this on your shop page now.",
  retry: "Couldn't save. What you typed is still here.",
  joinedNote: "We joined your introduction and longer story. Check it and save.",
  copyIntoNote: "Copy into note",
  privatePart: "Only Bhendi Bazaar sees this — to reach you about orders and payouts",
  phoneSaved: "Saved. We'll call this number about orders.",
  emailSaved: "Saved. New orders will come to this email.",
  taxTitle: "Tax and bank details",
  taxBody: "We'll ask before your first payout. Nothing to do now.",
} as const;

/** The name change sheet, exactly as ux.md signs it off (Q15). */
export const NAME_SHEET_COPY = {
  title: "Change your shop's name",
  confirm: (next: string, link: string) => `Buyers will see ${next} on your shop and every product. Your link stays ${link}.`,
  change: "Change name",
  keep: "Keep old name",
  changing: "Changing…",
  stillChanging: "Still changing…",
  changed: "Name changed.",
  retry: "Couldn't change it. Try again.",
  tryAgain: "Try again",
  close: "Close",
} as const;

/** Each optional row and the line it adds (ux Copy deck). */
export const OPTIONAL_ROWS = {
  about: { title: "About your shop", adds: "adds the 'About' section" },
  place: { title: "Area and city", adds: "shows under your name" },
  person: { title: "The person behind the shop", adds: "adds a face buyers trust" },
  social: { title: "Social handles", adds: "adds your Instagram and Facebook" },
  promise: { title: "Delivery and returns", adds: "tells buyers what to expect" },
} as const;

/** Labels, hints naming where each field shows, and placeholders from a real kind of shop (R2, Q12, Q13). */
export const FIELDS = {
  name: { label: "Shop name", hint: "Buyers see this on your shop and every product.", placeholder: "Noor Attar House" },
  logo: { label: "Logo", hint: "Shows at the top of your shop page and on WhatsApp shares." },
  tagline: {
    label: "One line about your shop",
    hint: "Buyers see this under your name on your shop page.",
    placeholder: "Hand-made attar since 1962",
  },
  about: {
    label: "About your shop",
    hint: "Buyers read this in the 'About' section of your shop page.",
    placeholder: "Who you are, what you make, and since when.",
  },
  location: {
    label: "Area and city",
    hint: "Buyers see this under your shop's name.",
    placeholder: "Bhendi Bazaar, Mumbai",
  },
  ownerName: { label: "Their name", hint: "Buyers see this with your 'About' section.", placeholder: "Hussain Bhai" },
  ownerRole: { label: "What they do", hint: "Buyers see this beside the name.", placeholder: "Owner" },
  ownerQuote: {
    label: "A line they'd say",
    hint: "Buyers see this quoted with the name.",
    placeholder: "Every bottle is filled by hand.",
  },
  ownerPhoto: { label: "Their photo", hint: "Buyers see this beside the name." },
  social: { hint: "Just the handle, like noorattar. Buyers see a link to it.", placeholder: "noorattar" },
  returnsPreset: { label: "Returns", hint: "Buyers see this in your shop's terms." },
  promiseNote: {
    label: "A note for buyers (optional)",
    hint: "Buyers see this under your returns promise.",
    placeholder: "Dispatched within two days from Bhendi Bazaar.",
  },
  oldText: "What you wrote before — buyers no longer see it",
  phone: {
    label: "Your mobile number",
    hint: "We'll call or message you about orders and pickups. Buyers never see it.",
    placeholder: "98765 43210",
  },
  email: { label: "Email for order updates", hint: "We send new orders here.", placeholder: "noorattar@gmail.com" },
  link: { label: "Your shop link", hint: "Changing it breaks links you've already shared." },
} as const;

/** "3,812 / 4,000". */
export const counter = (length: number, max: number) => `${formatCount(length)} / ${formatCount(max)}`;
