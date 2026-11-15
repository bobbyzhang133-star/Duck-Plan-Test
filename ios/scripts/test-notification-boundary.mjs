import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "duckplan-notification-boundary-"));
try {
  const executable = path.join(temporary, "boundary");
  execFileSync("xcrun", ["swiftc", "-parse-as-library", "-module-cache-path", path.join(temporary, "module-cache"),
    path.join(root, "ios/App/NativeScopeGuard.swift"), path.join(root, "ios/App/TaskNotificationStore.swift"), path.join(root, "tests/support/native-notification-boundary.swift"), "-o", executable], { stdio: "inherit" });
  execFileSync(executable, [], { stdio: "inherit" });
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
