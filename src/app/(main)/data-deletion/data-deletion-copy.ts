/** The public deletion-status page (meta-foundation ux.md, state matrix and copy deck). */
export const DATA_DELETION_COPY = {
  title: "Your data deletion request",
  done: "Your request is complete. We deleted what Bhendi Bazaar held about you from Instagram and WhatsApp.",
  inProgress: (doneBy: string) => `We're deleting what Bhendi Bazaar holds about you. It will be done by ${doneBy}.`,
  unknown: "We couldn't find a request with that reference. Check the link Meta gave you.",
  reference: (code: string) => `Reference: ${code}`,
} as const;

/** Read aloud or typed from a screenshot, so shown in groups of four. */
export const groupedCode = (code: string) => code.match(/.{1,4}/g)?.join("-") ?? code;
