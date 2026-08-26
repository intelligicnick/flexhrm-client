import * as pdfjsLib from "pdfjs-dist";

// Serve from /public so Hostinger Apache returns application/javascript reliably.
// Bundled .mjs assets often fail dynamic import on shared hosting (wrong MIME / SPA fallback).
const base = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
pdfjsLib.GlobalWorkerOptions.workerSrc = `${base}pdf.worker.min.js`;

export { pdfjsLib };
export default pdfjsLib;
