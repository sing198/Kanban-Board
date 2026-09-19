// Production uses the same-origin NGINX proxy. Local Vite development talks to Go.
const defaultApiUrl = import.meta.env.DEV ? "http://localhost:8080" : window.location.origin;
export const API_URL = import.meta.env.VITE_API_URL || defaultApiUrl;
export const WS_URL = import.meta.env.VITE_WS_URL || API_URL.replace(/^http/, "ws");
