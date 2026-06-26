/** Live Hostinger deployments (override via env at build/runtime). */
import clientConfig from "../../shared/client-config.json";

/** NestJS API origin — no trailing slash. */
export const PRODUCTION_API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || clientConfig.apiOrigin;

/** Public frontend origin for ID cards, QR codes, supervisor login — no trailing slash. */
export const PRODUCTION_FRONTEND_ORIGIN =
  import.meta.env.VITE_FRONTEND_ORIGIN?.replace(/\/$/, "") || clientConfig.frontendOrigin;

/** ID card QR verification base — includes /employee path, no trailing slash. */
export const PRODUCTION_ID_CARD_VERIFY_BASE = `${PRODUCTION_FRONTEND_ORIGIN}/employee`;
