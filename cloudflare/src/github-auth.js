// GitHub identity is verified server-side; provider tokens never enter browser storage.
import { HttpError, cookie, json, nowIso, randomToken, readJson, redirect, sha256, sha256Base64Url } from "./http.js";

const SESSION_COOKIE = "duckplan_session";
const OAUTH_COOKIE = "duckplan_github_oauth";
const OAUTH_PATH = "/api/auth/github";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIMEOUT = "GitHub sign-in timed out. Please try again.";

// Reject ambiguous cookies independently of the existing Google helper/draft.
function tokenCookie(request, name) {
  const values = (request.headers.get("Cookie") || "").split(";").map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  if (values.length !== 1) return "";
  try { return decodeURIComponent(values[0].slice(name.length + 1)); } catch { return ""; }
}
function secure(request) {
  const url = new URL(request.url);
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return false;
  throw new HttpError(400, "Sign-in requires HTTPS, except on this computer's local preview.");
}
export function githubNextPath(value) {
  if (typeof value !== "string" || value.length > 500 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://return.invalid"), path = decodeURIComponent(url.pathname);
    if (url.origin !== "https://return.invalid" || /[\\\u0000-\u001f\u007f]/.test(path) || path.startsWith("//") || /^\/api(?:\/|$)/i.test(path)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/"; }
}
export async function githubReady(env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return false;
  try {
    await env.DB.prepare("SELECT github_sub FROM users LIMIT 0").all();
    await env.DB.prepare("SELECT token_hash FROM github_oauth_transactions LIMIT 0").all();
    return true;
  } catch (error) {
    if (/no such (?:table|column)/i.test(error.message)) return false;
    throw error;
  }
}
const callbackUrl = request => `${new URL(request.url).origin}${OAUTH_PATH}/callback`;
const clearCookie = request => cookie(OAUTH_COOKIE, "", { maxAge: 0, path: OAUTH_PATH, secure: secure(request) });
const sessionHash = async request => {
  const token = tokenCookie(request, SESSION_COOKIE);
  return token ? sha256(token) : null;
};

async function start(request, env, auth) {
  secure(request);
  if (!(await githubReady(env))) throw new HttpError(503, "GitHub sign-in isn't connected on this copy of DuckPlan yet.");
  const linking = request.method === "POST";
  // Linking is an explicit CSRF-protected mutation, never a GET side effect.
  if (linking && request.headers.get("Origin") !== new URL(request.url).origin) throw new HttpError(403, "Connect GitHub from your DuckPlan account window.");
  const user = linking ? await auth.sessionUser(request, env) : null;
  if (linking && !user) throw new HttpError(401, "Sign in to DuckPlan before connecting GitHub.");
  const body = linking ? await readJson(request) : {};
  const next = githubNextPath(linking ? body.next : new URL(request.url).searchParams.get("next"));
  const browserToken = randomToken(), state = randomToken(), verifier = randomToken(48);
  const expires = new Date(Date.now() + 600_000).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM github_oauth_transactions WHERE expires_at <= ?").bind(nowIso()),
    env.DB.prepare("INSERT INTO github_oauth_transactions (token_hash, state_hash, origin, verifier, next_path, intent, user_id, session_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(await sha256(browserToken), await sha256(state), new URL(request.url).origin, verifier, next, linking ? "link" : "sign-in", user?.id || null, await sessionHash(request), expires),
  ]);
  const url = new URL("https://github.com/login/oauth/authorize");
  Object.entries({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: callbackUrl(request), scope: "read:user user:email", state, code_challenge: await sha256Base64Url(verifier), code_challenge_method: "S256" })
    .forEach(([key, value]) => url.searchParams.set(key, value));
  const headers = { "Set-Cookie": cookie(OAUTH_COOKIE, browserToken, { maxAge: 600, path: OAUTH_PATH, secure: secure(request) }) };
  return linking ? json({ url: url.href }, 200, headers) : redirect(url.href, headers);
}

async function providerJson(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("GitHub provider unavailable");
  return response.json();
}
async function identity(request, env, code, verifier) {
  const tokens = await providerJson("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: callbackUrl(request), code_verifier: verifier }),
  });
  if (tokens.error || typeof tokens.access_token !== "string" || !tokens.access_token || String(tokens.token_type).toLowerCase() !== "bearer") throw new Error("GitHub did not authorize sign-in");
  const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${tokens.access_token}`, "User-Agent": "DuckPlan", "X-GitHub-Api-Version": "2026-03-10" };
  const profile = await providerJson("https://api.github.com/user", { headers });
  if (!Number.isSafeInteger(profile.id) || profile.id <= 0 || typeof profile.login !== "string" || !profile.login) throw new Error("Missing GitHub identity");
  const emails = await providerJson("https://api.github.com/user/emails?per_page=100", { headers });
  const verified = Array.isArray(emails) ? emails.filter(row => row.verified === true && typeof row.email === "string" && row.email.length <= 254 && EMAIL_PATTERN.test(row.email)) : [];
  const selected = verified.find(row => row.primary === true) || verified[0];
  if (!selected) throw new HttpError(400, "Verify an email address in GitHub, then try signing in again.");
  return { sub: String(profile.id), email: selected.email.trim().toLowerCase(), name: String(profile.name || profile.login).trim().slice(0, 120) };
}

export async function resolveGithubUser(env, profile, pending) {
  const existing = await env.DB.prepare("SELECT * FROM users WHERE github_sub = ?").bind(profile.sub).first();
  if (pending.intent === "link") {
    if (existing && existing.id !== pending.user_id) throw new HttpError(409, "That GitHub account is already connected to another DuckPlan account.");
    // Session proof is checked again atomically after the provider round trip.
    let result;
    try {
      result = await env.DB.prepare("UPDATE users SET github_sub = ?, updated_at = ? WHERE id = ? AND (github_sub IS NULL OR github_sub = ?) AND EXISTS (SELECT 1 FROM sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ?)")
        .bind(profile.sub, nowIso(), pending.user_id, profile.sub, pending.session_hash, pending.user_id, nowIso()).run();
    } catch (error) {
      if (/UNIQUE constraint failed/i.test(error.message)) throw new HttpError(409, "That GitHub account is already connected to another DuckPlan account.");
      throw error;
    }
    if (!result.meta.changes) throw new HttpError(409, "Your account changed, or it already has a different GitHub account. Sign in again before connecting.");
    return env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(pending.user_id).first();
  }
  if (existing) return existing;
  const collision = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(profile.email).first();
  if (collision) throw new HttpError(409, "This email already has a DuckPlan account. Sign in using your existing method, then choose Connect GitHub in Your account.");
  await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, github_sub, display_name) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), profile.email, profile.sub, profile.name).run();
  const created = await env.DB.prepare("SELECT * FROM users WHERE github_sub = ?").bind(profile.sub).first();
  if (!created) throw new HttpError(409, "An account was created with this email while you were signing in. Sign in using its existing method first.");
  return created;
}

async function finish(request, env, auth) {
  const url = new URL(request.url), clear = clearCookie(request);
  const fail = message => {
    const target = new URL("/", url.origin); target.searchParams.set("sign_in_error", message);
    return redirect(target.href, { "Set-Cookie": clear });
  };
  try {
    if (!(await githubReady(env))) return fail("GitHub sign-in isn't connected on this copy of DuckPlan yet.");
    const token = tokenCookie(request, OAUTH_COOKIE);
    if (!token || token.length > 200) return fail(TIMEOUT);
    // DELETE RETURNING consumes one browser-bound transaction even on denial/failure.
    const pending = await env.DB.prepare("DELETE FROM github_oauth_transactions WHERE token_hash = ? RETURNING *").bind(await sha256(token)).first();
    if (!pending || pending.expires_at <= nowIso() || pending.origin !== url.origin || pending.state_hash !== await sha256(url.searchParams.get("state") || "") || pending.session_hash !== await sessionHash(request)) return fail(TIMEOUT);
    if (pending.intent === "link" && (await auth.sessionUser(request, env))?.id !== pending.user_id) return fail("Your account changed. Sign in again before connecting GitHub.");
    const code = url.searchParams.get("code");
    if (url.searchParams.get("error") || !code || code.length > 1000) return fail("GitHub sign-in was cancelled. Your planner has not changed.");
    const profile = await identity(request, env, code, pending.verifier);
    const user = await resolveGithubUser(env, profile, pending);
    const headers = new Headers({ Location: new URL(githubNextPath(pending.next_path), url.origin).href, "Cache-Control": "no-store" });
    headers.append("Set-Cookie", clear);
    headers.append("Set-Cookie", await auth.startSession(request, env, user.id, { rotate: true }));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    // Provider bodies and errors may contain sensitive tokens; do not forward/log them.
    return fail(error instanceof HttpError ? error.message : "GitHub sign-in couldn't finish. Please try again.");
  }
}

export async function handleGithub(request, env, path, auth) {
  if (path === OAUTH_PATH && ["GET", "POST"].includes(request.method)) return start(request, env, auth);
  if (path === `${OAUTH_PATH}/callback` && request.method === "GET") return finish(request, env, auth);
  return null;
}
