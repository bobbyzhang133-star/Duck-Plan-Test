// Small HTTP helpers shared by the Worker's routes.

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
}

export function redirect(location, headers = {}) {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store", ...headers } });
}

export async function readJson(request, maxBytes = 2_000_000) {
  const type = request.headers.get("Content-Type") || "";
  if (!type.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Send JSON.");
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "That request is too large.");
  try { return text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, "That request isn't valid JSON."); }
}

export function parseCookies(request) {
  const cookies = {};
  (request.headers.get("Cookie") || "").split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index > 0) cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return cookies;
}

export function cookie(name, value, { maxAge, path = "/", secure = true, httpOnly = true, sameSite = "Lax" } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function isSecure(request) { return new URL(request.url).protocol === "https:"; }

// Browsers send Origin on cross-site requests. Cookies are SameSite=Lax, and this rejects any
// state-changing request or WebSocket that comes from another site.
export function assertSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, "Not allowed from another site.");
}

// Only same-site paths are accepted as "where to go after sign-in".
export function safeNextPath(value) {
  const next = String(value || "/");
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/api/")) return "/";
  return next.slice(0, 500);
}

export function nowIso() { return new Date().toISOString(); }

export function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Base64Url(text) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
