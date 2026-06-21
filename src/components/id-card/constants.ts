/** Template-native size (cropped from official Intelligic ID card artwork). */
export const CARD_TEMPLATE = {
  front: "/id-card-front-blank.png",
  back: "/id-card-back-template.png",
} as const;

export const CARD_SIZE = {
  widthMm: 54,
  heightMm: 85.6,
  widthPx: 482,
  heightPx: 680,
} as const;

export const CARD_THEME = {
  navy: "#0B1B3D",
  accent: "#3D7CB5",
  white: "#FFFFFF",
} as const;

/** Overlay positions measured from the official front template (percent of card). */
export const FRONT_LAYOUT = {
  idNumber: { rightPx: 22, topPx: 20 },
  photo: { left: 22, top: 30.5, width: 56, height: 29 },
  fieldsBlock: { left: 9, top: 67.8, width: 82, height: 20.5 },
  qr: { rightPx: 30, bottomPx: 20, sizePx: 38 },
} as const;

const photoSlotWidthPx = Math.round((CARD_SIZE.widthPx * FRONT_LAYOUT.photo.width) / 100);
const photoSlotHeightPx = Math.round((CARD_SIZE.heightPx * FRONT_LAYOUT.photo.height) / 100);

export const CARD_PHOTO = {
  width: photoSlotWidthPx,
  height: photoSlotHeightPx,
  /** Square crop used for the circular portrait (matches on-screen layout). */
  circleSize: Math.min(photoSlotWidthPx, photoSlotHeightPx),
  aspectLabel: "portrait",
  minWidth: 80,
  minHeight: 96,
  maxFileSizeMb: 5,
} as const;
