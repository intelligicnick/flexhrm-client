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
  idNumber: { left: 36, top: 2.2, topOffsetPx: 4, width: 61, height: 6 },
  photo: { left: 22, top: 30.5, width: 56, height: 29 },
  fieldsBlock: { left: 9, top: 67.8, width: 82, height: 20.5 },
  qr: { right: 6, bottom: 4, sizePx: 30 },
} as const;

export const CARD_PHOTO = {
  width: Math.round((CARD_SIZE.widthPx * FRONT_LAYOUT.photo.width) / 100),
  height: Math.round((CARD_SIZE.heightPx * FRONT_LAYOUT.photo.height) / 100),
  aspectLabel: "portrait",
  minWidth: 80,
  minHeight: 96,
  maxFileSizeMb: 5,
} as const;
