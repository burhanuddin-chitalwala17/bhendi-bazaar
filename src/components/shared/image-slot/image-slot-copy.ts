/** Words for image-slot/ (ADR-0067): one object per component file, kept byte-identical to what it showed. */

/** image-slot-field.tsx */
export const IMAGE_SLOT_FIELD_COPY = {
  previewBeforeYouSave: "Preview, before you save",
  uploadOneOrBothIf: "Upload one or both. If a picture is a little off the shape, choose: keep it exact by cropping, or fit it in.",
  desktop1280Wide: "Desktop, 1280 wide",
  tablet834Wide: "Tablet, 834 wide",
  phone390Wide: "Phone, 390 wide",
  pickTheFocusPoint: "Pick the focus point",
} as const;

/** slot-crop-dialog.tsx */
export const SLOT_CROP_DIALOG_COPY = {
  keepItExact: "Keep it exact",
  useThisCrop: "Use this crop",
} as const;

/** slot-side-card.tsx */
export const SLOT_SIDE_CARD_COPY = {
  howToFitIt: "How to fit it",
  keepItExact: "Keep it exact",
  fitItIn: "Fit it in",
  edgeColour: "Edge colour",
  changeCrop: "Change crop",
  replace: "Replace",
  remove: "Remove",
  fitItInHint: "Show the whole picture; the edges are filled with a colour from it.",
} as const;

export const SLOT_CROP_HINT_COPY = {
  drag: "Drag the picture to choose what stays.",
  wait: "Wait for the picture to load",
} as const;

export const IMAGE_SLOT_FIELD_LABEL_COPY = {
  desktop: "Upload desktop picture",
  phone: "Add a phone version",
} as const;
