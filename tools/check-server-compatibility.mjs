import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Read-only release gate. Do not log planner records or authentication material.
export async function checkServerCompatibility({ origin, cookie = "", fetchImpl = fetch }) {
  const target = new URL(origin);
  if (target.username || target.password || target.search || target.hash || target.pathname !== "/"
    || !["https:", "http:"].includes(target.protocol)
    || target.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
    throw new Error("Use an HTTPS origin, or a loopback HTTP fixture origin, without credentials or a path.");
  }
  if (/[\r\n]/.test(cookie)) throw new Error("The session file must contain one Cookie header value.");
  const base = { origin: target.origin, method: "GET", checkedPath: "/api/planner" };
  let response;
  try {
    response = await fetchImpl(`${target.origin}/api/planner`, {
      method: "GET", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    });
  } catch (error) { return { ...base, ok: false, reason: "unreachable", errorType: error.name }; }
  if (response.status === 401) return { ...base, ok: false, reason: "authentication-required", status: 401 };
  if (!response.ok) return { ...base, ok: false, reason: "server-error", status: response.status };
  if (!response.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return { ...base, ok: false, reason: "invalid-content-type", status: response.status };
  }
  let data;
  try {
    const bytes = await response.arrayBuffer();
    // Match the existing native URLSession bridge's byte and UTF-8 constraints.
    if (bytes.byteLength > 8_000_000) return { ...base, ok: false, reason: "response-too-large", status: response.status };
    data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  }
  catch { return { ...base, ok: false, reason: "invalid-json", status: response.status }; }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ...base, ok: false, reason: "invalid-planner", status: response.status };
  const arrays = ["classes", "items", "templates", "resources", "goals", "habits", "habit_checkins", "notes"];
  const missing = arrays.filter((key) => !Array.isArray(data[key]));
  const organization = data.organization && typeof data.organization === "object" && !Array.isArray(data.organization);
  if (!organization) missing.push("organization");
  const library = ["templates", "resources"].every((key) => Array.isArray(data[key])) && Boolean(organization);
  const personal = ["goals", "habits", "habit_checkins", "notes"].every((key) => Array.isArray(data[key]));
  return {
    ...base, ok: missing.length === 0, reason: missing.length ? "incompatible-planner" : "compatible", status: response.status,
    features: { tasks: Array.isArray(data.items) && Array.isArray(data.classes), templates: library, resources: library,
      organization: library, goals: personal, habits: personal, notes: personal }, missing,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const value = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  const origin = value("--origin");
  if (!origin) throw new Error("Usage: node tools/check-server-compatibility.mjs --origin https://host [--cookie-file /private/test-session.cookie]");
  const file = value("--cookie-file");
  const cookie = file ? (await readFile(file, "utf8")).trim().replace(/^Cookie:\s*/i, "") : "";
  const result = await checkServerCompatibility({ origin, cookie });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    console.error(result.reason === "authentication-required"
      ? "BLOCKED: use a dedicated authorized test session. Anonymous 401 is not feature compatibility evidence."
      : "FAIL: verify the target Worker and tracked migrations before releasing its client. No server records were changed.");
    process.exitCode = result.reason === "authentication-required" ? 2 : 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
