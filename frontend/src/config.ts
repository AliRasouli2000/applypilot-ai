// Backend base URL. Set VITE_API_URL at build time for production.
export const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");
