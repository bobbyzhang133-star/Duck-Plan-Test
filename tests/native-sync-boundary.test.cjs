const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

test("native sync parses linked/manual times and rejects late owners before side effects or acknowledgement", { skip: process.platform !== "darwin" }, () => {
  const directory = mkdtempSync(join(tmpdir(), "duckplan-sync-boundary-"));
  try {
    const executable = join(directory, "native-sync-boundary");
    execFileSync("xcrun", ["swiftc", "-parse-as-library", "-module-cache-path", join(tmpdir(), "duckplan-native-sync-swift-cache"),
      "ios/App/NativeSyncDomain.swift", "ios/App/NativeSyncEngine.swift", "tests/support/native-sync-boundary.swift", "-o", executable], { encoding: "utf8", timeout: 180000 });
    assert.match(execFileSync(executable, { encoding: "utf8", timeout: 15000 }), /Native sync boundaries: 21 PASS/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
