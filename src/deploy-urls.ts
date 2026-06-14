/** Live Hostinger deployments (override via env at build/runtime). */

/** NestJS API origin — no trailing slash. */
export const PRODUCTION_API_BASE =
  "https://midnightblue-partridge-476451.hostingersite.com";

/** Public frontend origin for ID cards, QR codes, supervisor login — no trailing slash. */
export const PRODUCTION_FRONTEND_ORIGIN =
  "https://greenyellow-woodpecker-750354.hostingersite.com";

/** ID card QR verification base — includes /employee path, no trailing slash. */
export const PRODUCTION_ID_CARD_VERIFY_BASE = `${PRODUCTION_FRONTEND_ORIGIN}/employee`;
