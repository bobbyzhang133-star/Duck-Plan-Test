// Accounts without a hosted auth service and without sending email: email + password (PBKDF2
// via Web Crypto) with a one-time recovery code instead of "reset by email", plus optional Google
// sign-in (OpenID Connect authorization-code flow with PKCE). Sessions are random tokens in an
// HttpOnly cookie; the database stores only their SHA-256 hash.
//
// The email is only a login name: it is never verified and nothing is ever sent to it.
import { HttpError, cookie, isSecure, json, nowIso, parseCookies, randomToken, readJson, redirect, safeNextPath, sha256, sha256Base64Url } from "./http.js";

export const SESSION_COOKIE = "duckplan_session";
const OAUTH_COOKIE = "duckplan_oauth";
const SESSION_DAYS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

// Workers caps PBKDF2 at 100,000 iterations, and the free plan allows ~10 ms of CPU per request.
// The count is stored in each hash, so raising it later upgrades accounts as they sign in.
export const PBKDF2_ITERATIONS = 50_000;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;
// Wrong passwords or recovery codes per email before it has to wait.
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MINUTES = 15;
// Recovery codes: 20 characters from an alphabet without look-alikes (0/O, 1/I/L), ~99 bits.
const RECOVERY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

const addMinutes = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();

export function publicUser(row) {
  return row ? { id: row.id, email: row.email, displayName: row.display_name || "", hasPassword: Boolean(row.password_hash) } : null;
}

export async function sessionUser(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  return env.DB.prepare(
    "SELECT u.id, u.email, u.display_name, u.password_hash FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
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

// Passwords ------------------------------------------------------------------------

const toBase64Url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (text) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=")), (char) => char.charCodeAt(0));

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(await pbkdf2(password, salt, iterations))}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, hash] = String(stored || "").split("$");
  if (scheme !== "pbkdf2-sha256" || !salt || !hash) return false;
  return sameBytes(await pbkdf2(password, fromBase64Url(salt), Number(iterations)), fromBase64Url(hash));
}

function readEmail(body) {
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new HttpError(400, "Enter a valid email address.");
  return email;
}

function readNewPassword(value) {
  const password = String(value || "");
  if (password.length < MIN_PASSWORD) throw new HttpError(400, `Use a password with at least ${MIN_PASSWORD} characters.`);
  if (password.length > MAX_PASSWORD) throw new HttpError(400, `Use a password with at most ${MAX_PASSWORD} characters.`);
  return password;
}

export function newRecoveryCode() {
  const chars = [];
  while (chars.length < 20) {
    // 248 = 8 × 31, so taking bytes below it keeps every character equally likely.
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) if (byte < 248 && chars.length < 20) chars.push(RECOVERY_ALPHABET[byte % 31]);
  }
  return chars.join("").match(/.{5}/g).join("-");
}
const recoveryHash = (code) => sha256(String(code || "").toUpperCase().replace(/[^0-9A-Z]/g, ""));

// Slow down password guessing: a limited number of wrong guesses per email per window.
async function assertNotLocked(env, email) {
  const recent = await env.DB.prepare("SELECT count(*) AS n, min(created_at) AS oldest FROM login_failures WHERE email = ? AND created_at > ?")
    .bind(email, addMinutes(-FAILURE_WINDOW_MINUTES)).first();
  if (recent.n < MAX_FAILURES) return;
  const minutes = Math.max(1, Math.ceil((Date.parse(recent.oldest) + FAILURE_WINDOW_MINUTES * 60_000 - Date.now()) / 60_000));
  throw new HttpError(429, `Too many wrong tries for that account. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
}
async function recordFailure(env, email) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM login_failures WHERE created_at < ?").bind(addMinutes(-24 * 60)),
    env.DB.prepare("INSERT INTO login_failures (email) VALUES (?)").bind(email),
  ]);
}
const clearFailures = (env, email) => env.DB.prepare("DELETE FROM login_failures WHERE email = ?").bind(email).run();

async function signUp(request, env) {
  const body = await readJson(request);
  const email = readEmail(body);
  const password = readNewPassword(body.password);
  const recoveryCode = newRecoveryCode();
  const id = crypto.randomUUID();
  const inserted = await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, display_name, password_hash, recovery_hash) VALUES (?, ?, ?, ?, ?)")
    .bind(id, email, email.split("@")[0], await hashPassword(password), await recoveryHash(recoveryCode)).run();
  if (!inserted.meta.changes) throw new HttpError(409, "That email already has a DuckPlan account. Sign in instead.");
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  return json({ user: publicUser(user), recoveryCode }, 201, { "Set-Cookie": await startSession(request, env, id) });
}

async function signIn(request, env) {
  const body = await readJson(request);
  const email = readEmail(body);
  const password = String(body.password || "");
  await assertNotLocked(env, email);
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (user && !user.password_hash && user.google_sub) throw new HttpError(400, "That account signs in with Google.");
  if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
    await recordFailure(env, email);
    throw new HttpError(401, "That email and password don't match.");
  }
  await clearFailures(env, email);
  if (Number(user.password_hash.split("$")[1]) !== PBKDF2_ITERATIONS) {
    await env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").bind(await hashPassword(password), nowIso(), user.id).run();
  }
  return json({ user: publicUser(user) }, 200, { "Set-Cookie": await startSession(request, env, user.id) });
}

// Forgot password: the recovery code shown at sign-up sets a new password, signs out every other
// device, and is replaced by a fresh code.
async function recover(request, env) {
  const body = await readJson(request);
  const email = readEmail(body);
  const password = readNewPassword(body.newPassword);
  await assertNotLocked(env, email);
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  const given = await recoveryHash(body.recoveryCode);
  if (!user?.recovery_hash || !sameBytes(new TextEncoder().encode(given), new TextEncoder().encode(user.recovery_hash))) {
    await recordFailure(env, email);
    throw new HttpError(400, "That email and recovery code don't match.");
  }
  const recoveryCode = newRecoveryCode();
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ?, recovery_hash = ?, updated_at = ? WHERE id = ?").bind(await hashPassword(password), await recoveryHash(recoveryCode), nowIso(), user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM login_failures WHERE email = ?").bind(email),
  ]);
  return json({ user: publicUser({ ...user, password_hash: "set" }), recoveryCode }, 200, { "Set-Cookie": await startSession(request, env, user.id) });
}

// Signed in: check the current password (if the account has one) before changing account secrets.
async function confirmPassword(env, user, password) {
  const row = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
  if (!row.password_hash) return row;
  await assertNotLocked(env, row.email);
  if (!(await verifyPassword(String(password || ""), row.password_hash))) {
    await recordFailure(env, row.email);
    throw new HttpError(401, "Your current password isn't right.");
  }
  return row;
}

async function changePassword(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const password = readNewPassword(body.newPassword);
  const row = await confirmPassword(env, user, body.currentPassword);
  // A Google account setting its first password also gets its first recovery code.
  const recoveryCode = row.recovery_hash ? null : newRecoveryCode();
  const current = await sha256(parseCookies(request)[SESSION_COOKIE]);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ?, recovery_hash = coalesce(?, recovery_hash), updated_at = ? WHERE id = ?")
      .bind(await hashPassword(password), recoveryCode && (await recoveryHash(recoveryCode)), nowIso(), row.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?").bind(row.id, current),
  ]);
  return json({ ok: true, recoveryCode });
}

async function replaceRecoveryCode(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const row = await confirmPassword(env, user, body.password);
  const recoveryCode = newRecoveryCode();
  await env.DB.prepare("UPDATE users SET recovery_hash = ?, updated_at = ? WHERE id = ?").bind(await recoveryHash(recoveryCode), nowIso(), row.id).run();
  return json({ recoveryCode });
}

// Google sign-in ----------------------------------------------------------------

export async function findOrCreateGoogleUser(env, { email, googleSub, name = null }) {
  const normalized = String(email).trim().toLowerCase();
  const bySub = await env.DB.prepare("SELECT * FROM users WHERE google_sub = ?").bind(googleSub).first();
  if (bySub) return bySub;
  const byEmail = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(normalized).first();
  if (byEmail) {
    // Password accounts' emails are never verified, so someone could have registered this address
    // first. Joining it to the Google account would hand them the real owner's planner.
    if (byEmail.password_hash) throw new HttpError(409, "That email already has a DuckPlan password account. Sign in with your password.");
    if (!byEmail.google_sub) await env.DB.prepare("UPDATE users SET google_sub = ?, updated_at = ? WHERE id = ?").bind(googleSub, nowIso(), byEmail.id).run();
    return byEmail;
  }
  const id = crypto.randomUUID();
  // INSERT OR IGNORE plus a re-read handles two sign-ins racing for the same new email.
  await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, google_sub, display_name) VALUES (?, ?, ?, ?)").bind(id, normalized, googleSub, name || normalized.split("@")[0]).run();
  return env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(normalized).first();
}

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
  return JSON.parse(new TextDecoder().decode(fromBase64Url(part)));
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

  let user;
  try { user = await findOrCreateGoogleUser(env, { email: claims.email, googleSub: claims.sub, name: claims.name }); } catch (error) {
    if (error instanceof HttpError) return fail(error.message);
    throw error;
  }
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
    return json({ user: publicUser(await sessionUser(request, env)), providers: { password: true, google: googleConfigured(env) } });
  }
  if (method === "POST") {
    if (path === "/api/auth/sign-up") return signUp(request, env);
    if (path === "/api/auth/sign-in") return signIn(request, env);
    if (path === "/api/auth/recover") return recover(request, env);
    if (path === "/api/auth/password") return changePassword(request, env);
    if (path === "/api/auth/recovery-code") return replaceRecoveryCode(request, env);
    if (path === "/api/auth/sign-out") return signOut(request, env);
  }
  if (path === "/api/auth/google" && method === "GET") return startGoogle(request, env);
  if (path === "/api/auth/google/callback" && method === "GET") return finishGoogle(request, env);
  return null;
}
