// Overwritten at deploy time, or set PUBLIC_API_URL when running `npm run build`.
// Empty string = browser calls same-origin /api (Node proxy or reverse proxy required).
window.__FLEXHRM_API_BASE__ = process.env.FLEXHRM_API_BASE;
