// Copy an approved website source into the existing native checkout, retaining bounded native overlays.
// Default is a read-only plan. Use --apply only after the intended website source is ready.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const destination = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = process.argv[2] && path.resolve(process.argv[2]);
if (!source || source === destination || !fs.existsSync(path.join(source, "landing/index.html"))) throw new Error("Pass the approved separate website checkout path.");
const apply = process.argv.includes("--apply");
const files = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(directory, e.name)) : e.isFile() ? [path.join(directory, e.name)] : []);
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const protect = ["ios/App", "ios/Widgets", "ios/Shared", "ios/Resources", "ios/DuckPlan.xcodeproj/project.pbxproj"];
const protectedHashes = () => Object.fromEntries(protect.flatMap(relative => {
  const full = path.join(destination, relative); return fs.statSync(full).isDirectory() ? files(full) : [full];
}).map(full => [path.relative(destination, full), hash(fs.readFileSync(full))]));
const beforeNative = protectedHashes();
const nativeTransport = fs.readFileSync(path.join(destination, "landing/native-cloud.js"));
const approvedMaster = "landing/assets/duckplan-sigma-head-v11.png";
if (hash(fs.readFileSync(path.join(source, approvedMaster))) !== hash(fs.readFileSync(path.join(destination, approvedMaster)))) throw new Error("Approved native icon master differs; review artwork before copying.");
const prepared = new Map(files(path.join(source, "landing")).map(full => [path.relative(source, full), fs.readFileSync(full)]));
const overlay = (relative, update) => {
  if (!prepared.has(relative)) throw new Error(`Missing website overlay input ${relative}`);
  prepared.set(relative, Buffer.from(update(prepared.get(relative).toString("utf8"))));
};
const replaceOnce = (text, anchor, replacement) => {
  if (text.split(anchor).length !== 2) throw new Error(`Native overlay anchor missing or repeated: ${anchor.slice(0, 90)}`);
  return text.replace(anchor, replacement);
};
overlay("landing/index.html", text => text.includes('./native-cloud.js') ? text : replaceOnce(text, '    <script src="./cloud-config.js"></script>', '    <script src="./native-cloud.js"></script>\n    <script src="./cloud-config.js"></script>'));
overlay("landing/cloud-config.js", text => text.includes("if (window.DuckNativeCloud)") ? text : text + '\n// The bundled main frame uses the restricted native URLSession transport.\nwindow.DUCKPLAN_CLOUD.native = false;\nif (window.DuckNativeCloud) {\n  window.DUCKPLAN_CLOUD = { apiUrl: window.DuckNativeCloud.apiUrl, native: true };\n}\n');
overlay("landing/app.js", text => {
  if (!text.includes("WebSocketImpl: window.DUCKPLAN_CLOUD?.native")) text = replaceOnce(text, '  config: window.DUCKPLAN_CLOUD || {},', '  config: window.DUCKPLAN_CLOUD || {},\n  WebSocketImpl: window.DUCKPLAN_CLOUD?.native ? null : window.WebSocket,');
  if (!text.includes("Native sessions belong to URLSession")) text = replaceOnce(text, 'setInterval(refreshPlannerClock, 60000);', 'setInterval(refreshPlannerClock, 60000);\n// Native sessions belong to URLSession, so foreground refresh replaces browser WebSockets.\nif (window.DUCKPLAN_CLOUD?.native) {\n  let refreshing = false;\n  setInterval(async () => {\n    if (document.hidden || refreshing) return;\n    refreshing = true;\n    try { await store.refresh(); } finally { refreshing = false; }\n  }, 30000);\n}');
  return text;
});
overlay("landing/planner-store.js", text => {
  if (!text.includes('google: !config.native')) text = replaceOnce(text, 'google: Boolean(session.providers?.google)', 'google: !config.native && Boolean(session.providers?.google)');
  if (!text.includes('if (config.native) throw new Error("Use your DuckPlan email and password in the iPhone app.");')) text = replaceOnce(text, '      async signInWithGoogle() {', '      async signInWithGoogle() {\n        if (config.native) throw new Error("Use your DuckPlan email and password in the iPhone app.");');
  return text;
});
overlay("landing/app-install.js", text => text.includes("installCopy.textContent = window.DuckNativeCloud") ? text : replaceOnce(text,
  "installCopy.textContent = 'DuckPlan iPhone app. Tasks and ringing alarms are saved on this device.';",
  "installCopy.textContent = window.DuckNativeCloud\n        ? 'DuckPlan iPhone app. Sign in below to sync tasks. Alarms and task notifications are scheduled on this device.'\n        : 'DuckPlan iPhone app. Tasks, alarms and task notifications are saved on this device.';"));
overlay("landing/service-worker.js", text => text.includes('"./native-cloud.js"') ? text : replaceOnce(text, '  "./cloud-config.js",', '  "./native-cloud.js",\n  "./cloud-config.js",'));
prepared.set("landing/native-cloud.js", nativeTransport);
// Shared tests are copied without deleting native-only tests or fixture support.
for (const full of files(path.join(source, "tests"))) prepared.set(path.relative(source, full), fs.readFileSync(full));
// Only the feature's changed backend modules/new migrations: no configuration/secrets/dependencies.
const changed = execFileSync("git", ["diff", "--name-only", "cd346d0", "--", "cloudflare/src", "cloudflare/migrations"], { cwd: source, encoding: "utf8" }).trim().split("\n").filter(Boolean);
const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "cloudflare/src", "cloudflare/migrations"], { cwd: source, encoding: "utf8" }).trim().split("\n").filter(Boolean);
for (const relative of new Set([...changed, ...untracked, "cloudflare/src/index.js", "cloudflare/src/organization.js", "cloudflare/src/personal.js", "cloudflare/migrations/0004_product_organization.sql", "cloudflare/migrations/0005_personal_planning.sql"])) {
  if (!/^cloudflare\/(?:src\/[^/]+\.js|migrations\/000[4-6]_[^/]+\.sql)$/.test(relative)) throw new Error(`Unexpected feature backend path ${relative}`);
  const target = path.join(destination, relative);
  const contents = fs.readFileSync(path.join(source, relative));
  if (fs.existsSync(target) && hash(fs.readFileSync(target)) !== hash(contents)) {
    let baseline = null;
    try { baseline = execFileSync("git", ["show", `8334d6e:${relative}`], { cwd: destination, stdio: ["ignore", "pipe", "ignore"] }); } catch {}
    if (!baseline || hash(fs.readFileSync(target)) !== hash(baseline)) throw new Error(`Native backend file has local changes: ${relative}`);
  }
  prepared.set(relative, contents);
}
const overlays = [...prepared.keys()].filter(relative => relative.startsWith("landing/") && relative !== "landing/native-cloud.js" && hash(prepared.get(relative)) !== hash(fs.readFileSync(path.join(source, relative))));
const result = { applied: apply, source, destination, websiteFiles: files(path.join(source, "landing")).length, nativeLandingFiles: [...prepared.keys()].filter(p => p.startsWith("landing/")).length, overlays, nativeExtra: "landing/native-cloud.js", sharedTests: [...prepared.keys()].filter(p => p.startsWith("tests/")).length, backend: [...prepared.keys()].filter(p => p.startsWith("cloudflare/")), nativeProtectedBefore: beforeNative };
if (apply) {
  for (const [relative, contents] of prepared) { const target = path.join(destination, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, contents); }
  if (JSON.stringify(protectedHashes()) !== JSON.stringify(beforeNative)) throw new Error("Native/signing/artwork unexpectedly changed during landing sync.");
  result.nativeProtectedAfter = protectedHashes();
  result.landingManifest = Object.fromEntries(files(path.join(destination, "landing")).map(full => [path.relative(path.join(destination, "landing"), full), hash(fs.readFileSync(full))]));
}
const output = process.env.DUCKPLAN_NATIVE_SYNC_REPORT;
if (output) fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ applied: apply, websiteFiles: result.websiteFiles, nativeLandingFiles: result.nativeLandingFiles, overlays, backend: result.backend, sharedTests: result.sharedTests }));
