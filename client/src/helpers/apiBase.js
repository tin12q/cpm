const envApi =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_URL) ||
  `${window.location.origin}/api`;

const apiBase = String(envApi).replace(/\/+$/, "");

export default apiBase;
