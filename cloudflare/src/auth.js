// Accounts without a hosted auth service: email magic links (Cloudflare Email Service) and Google
// sign-in (OpenID Connect authorization-code flow with PKCE). Sessions are random tokens in an
// HttpOnly cookie; the database stores only their SHA-256 hash.
import { HttpError, cookie, isSecure, json, nowIso, parseCookies, randomToken, readJson, redirect, safeNextPath, sha256, sha256Base64Url } from "./http.js";

export const SESSION_COOKIE = "duckplan_session";
const OAUTH_COOKIE = "duckplan_oauth";
const SESSION_DAYS = 30;
const LOGIN_TOKEN_MINUTES = 15;
const MAX_LINKS_PER_WINDOW = 3;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

const addMinutes = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();

export function publicUser(row) {
  return row ? { id: row.id, email: row.email, displayName: row.display_name || "" } : null;
}

export async function sessionUser(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  return env.DB.prepare(
    "SELECT u.id, u.email, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
  ).bind(await sha256(token), nowIso()).first();
}

export async function requireUser(request, env) {
  const user = await sessionUser(request, env);
  if (!user) throw new HttpError(401, "Sign in first.");
  return user;
}

async function startSession(request, env, userId) {
  const token = randomToken();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), userId, addMinutes(SESSION_DAYS * 24 * 60)).run();
  return cookie(SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 86_400, secure: isSecure(request) });
}

export async function findOrCreateUser(env, { email, googleSub = null, name = null }) {
  const normalized = String(email).trim().toLowerCase();
  if (googleSub) {
    const bySub = await env.DB.prepare("SELECT * FROM users WHERE google_sub = ?").bind(googleSub).first();
    if (bySub) return bySub;
  }
  const byEmail = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(normalized).first();
  if (byEmail) {
    if (googleSub && !byEmail.google_sub) await env.DB.prepare("UPDATE users SET google_sub = ?, updated_at = ? WHERE id = ?").bind(googleSub, nowIso(), byEmail.id).run();
    return byEmail;
  }
  const id = crypto.randomUUID();
  const displayName = name || normalized.split("@")[0];
  // INSERT OR IGNORE plus a re-read handles two sign-ins racing for the same new email.
  await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, google_sub, display_name) VALUES (?, ?, ?, ?)").bind(id, normalized, googleSub, displayName).run();
  return env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(normalized).first();
}

// Email magic links -----------------------------------------------------------

function signInEmail(link) {
  return {
    subject: "Your DuckPlan sign-in link",
    text: `Open this link to sign in to DuckPlan:\n\n${link}\n\nIt works once and expires in ${LOGIN_TOKEN_MINUTES} minutes. If you didn't ask for it, ignore this email.`,
    html: `<p>Open this link to sign in to DuckPlan:</p><p><a href="${link}">Sign in to DuckPlan</a></p><p>It works once and expires in ${LOGIN_TOKEN_MINUTES} minutes. If you didn't ask for it, ignore this email.</p>`,
  };
}

async function sendMagicLink(request, env) {
  const body = await readJson(request);
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new HttpError(400, "Enter a valid email address.");
  // The limit stops someone flooding an inbox, so only links that were sent and never used count;
  // signing in with a link gives that slot back.
  const windowStart = addMinutes(-LOGIN_TOKEN_MINUTES);
  const recent = await env.DB.prepare("SELECT count(*) AS n, min(created_at) AS oldest FROM login_tokens WHERE email = ? AND created_at > ? AND used_at IS NULL")
    .bind(email, windowStart).first();
  if (recent.n >= MAX_LINKS_PER_WINDOW) {
    const minutes = Math.max(1, Math.ceil((Date.parse(recent.oldest) + LOGIN_TOKEN_MINUTES * 60_000 - Date.now()) / 60_000));
    throw new HttpError(429, `We've already sent ${MAX_LINKS_PER_WINDOW} sign-in links to that address. Use one of those, or try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }

  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM login_tokens WHERE expires_at < ?").bind(addMinutes(-24 * 60)),
    env.DB.prepare("INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)").bind(await sha256(token), email, addMinutes(LOGIN_TOKEN_MINUTES)),
  ]);
  // The token goes in the query string of the planner page, not an API URL: link scanners that
  // prefetch email links only load the page, and the page's script exchanges the token.
  const link = new URL(safeNextPath(body.next), new URL(request.url).origin);
  link.searchParams.set("login_token", token);

  if (env.EMAIL_MODE === "log" || !env.EMAIL) {
    console.log(`[DuckPlan] sign-in link for ${email}: ${link.href}`);
  } else {
    try {
      await env.EMAIL.send({ to: email, from: env.EMAIL_FROM, ...signInEmail(link.href) });
    } catch (error) {
      console.error("magic link email failed", error?.code || "", error?.message || error);
      throw new HttpError(502, "Couldn't send the sign-in email. Try again in a few minutes.");
    }
  }
  return json({ ok: true });
}

async function verifyMagicLink(request, env) {
  const body = await readJson(request);
  const token = String(body.token || "");
  if (!token) throw new HttpError(400, "That sign-in link is missing its code.");
  // One statement both checks and spends the token, so a link can't be used twice.
  const row = await env.DB.prepare("UPDATE login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING email")
    .bind(nowIso(), await sha256(token), nowIso()).first();
  if (!row) throw new HttpError(400, "That sign-in link has expired or was already used. Ask for a new one.");
  const user = await findOrCreateUser(env, { email: row.email });
  return json({ user: publicUser(user) }, 200, { "Set-Cookie": await startSession(request, env, user.id) });
}

// Google sign-in ----------------------------------------------------------------

function googleConfigured(env) { return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET); }
function callbackUrl(request) { return `${new URL(request.url).origin}/api/auth/google/callback`; }

async function startGoogle(request, env) {
  if (!googleConfigured(env)) throw new HttpError(404, "Google sign-in isn't set up on this copy of DuckPlan.");
  const state = randomToken(16);
  const verifier = randomToken(48);
  const nonce = randomToken(16);
  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  Object.entries({
    client_id: env.GOOGLE_CLIENT_ID, redirect_uri: callbackUrl(request), response_type: "code", scope: "openid email profile",
    state, nonce, code_challenge: await sha256Base64Url(verifier), code_challenge_method: "S256", prompt: "select_account",
  }).forEach(([key, value]) => auth.searchParams.set(key, value));
  const pending = btoa(JSON.stringify({ state, verifier, nonce, next }));
  return redirect(auth.href, { "Set-Cookie": cookie(OAUTH_COOKIE, pending, { maxAge: 600, path: "/api/auth/google", secure: isSecure(request) }) });
}

function decodeJwtPayload(jwt) {
  const part = String(jwt || "").split(".")[1];
  if (!part) throw new Error("missing id_token");
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))));
}

async function finishGoogle(request, env) {
  const url = new URL(request.url);
  const clearOauth = cookie(OAUTH_COOKIE, "", { maxAge: 0, path: "/api/auth/google", secure: isSecure(request) });
  const fail = (message) => {
    const target = new URL("/", url.origin);
    target.searchParams.set("sign_in_error", message);
    return redirect(target.href, { "Set-Cookie": clearOauth });
  };
  let pending;
  try { pending = JSON.parse(atob(parseCookies(request)[OAUTH_COOKIE] || "")); } catch { return fail("Google sign-in timed out. Try again."); }
  if (!googleConfigured(env) || !pending?.state || url.searchParams.get("state") !== pending.state) return fail("Google sign-in timed out. Try again.");
  if (url.searchParams.get("error") || !url.searchParams.get("code")) return fail("Google sign-in was cancelled.");

  // The id_token comes straight from Google's token endpoint over TLS, authenticated with our
  // client secret, so OpenID Connect allows using it without checking its signature (Core §3.1.3.7).
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: url.searchParams.get("code"), client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(request), grant_type: "authorization_code", code_verifier: pending.verifier,
    }),
  });
  if (!response.ok) return fail("Google sign-in didn't finish. Try again.");
  let claims;
  try { claims = decodeJwtPayload((await response.json()).id_token); } catch { return fail("Google sign-in didn't finish. Try again."); }
  const valid = GOOGLE_ISSUERS.has(claims.iss) && claims.aud === env.GOOGLE_CLIENT_ID && claims.exp * 1000 > Date.now()
    && claims.nonce === pending.nonce && claims.sub && claims.email && claims.email_verified === true;
  if (!valid) return fail("Google didn't confirm that email address.");

  const user = await findOrCreateUser(env, { email: claims.email, googleSub: claims.sub, name: claims.name });
  const headers = new Headers({ Location: new URL(safeNextPath(pending.next), url.origin).href, "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearOauth);
  headers.append("Set-Cookie", await startSession(request, env, user.id));
  return new Response(null, { status: 302, headers });
}

async function signOut(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return json({ ok: true }, 200, { "Set-Cookie": cookie(SESSION_COOKIE, "", { maxAge: 0, secure: isSecure(request) }) });
}

export async function handleAuth(request, env, path) {
  const method = request.method;
  if (path === "/api/session" && method === "GET") {
    return json({ user: publicUser(await sessionUser(request, env)), providers: { email: true, google: googleConfigured(env) } });
  }
  if (path === "/api/auth/email" && method === "POST") return sendMagicLink(request, env);
  if (path === "/api/auth/email/verify" && method === "POST") return verifyMagicLink(request, env);
  if (path === "/api/auth/google" && method === "GET") return startGoogle(request, env);
  if (path === "/api/auth/google/callback" && method === "GET") return finishGoogle(request, env);
  if (path === "/api/auth/sign-out" && method === "POST") return signOut(request, env);
  return null;
}
