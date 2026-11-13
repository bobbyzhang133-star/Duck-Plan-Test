// Compile the actual native client with Foundation and exercise its request boundary.
// No production request or cookie read is made by these tests.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = fs.readFileSync(path.join(root, "ios/App/PlannerWebView.swift"), "utf8");
const start = source.indexOf("final class NativeCloudClient:");
if (start === -1) throw new Error("Native cloud client not found");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "duckplan-cloud-boundary-"));
const file = path.join(temporary, "Boundary.swift");
const binary = path.join(temporary, "boundary");
try {
  fs.writeFileSync(file, "import Foundation\n" + source.slice(start) + `
@main struct BoundaryTests {
    static func main() async throws {
        let client = NativeCloudClient()
        precondition(client.apiURL.absoluteString == "https://duckplan.duckplan-cloudflare.workers.dev/api")
        let rejected = [
            "https://unrelated.example/api/session",
            "http://duckplan.duckplan-cloudflare.workers.dev/api/session",
            "https://duckplan.duckplan-cloudflare.workers.dev:8443/api/session",
            "https://user:password@duckplan.duckplan-cloudflare.workers.dev/api/session",
            "https://duckplan.duckplan-cloudflare.workers.dev/api/session#fragment",
            "https://duckplan.duckplan-cloudflare.workers.dev/not-api/session",
            "https://duckplan.duckplan-cloudflare.workers.dev/api/auth/google",
            "https://duckplan.duckplan-cloudflare.workers.dev/api/live"
        ]
        for url in rejected {
            do {
                _ = try await client.request(["url": url, "method": "GET"])
                fatalError("Disallowed URL was accepted")
            } catch let error as URLError { precondition(error.code == .unsupportedURL) }
        }
        let endpoint = client.apiURL.absoluteString + "/session"
        for method in ["TRACE", "CONNECT", "OPTIONS"] {
            do {
                _ = try await client.request(["url": endpoint, "method": method])
                fatalError("Disallowed method was accepted")
            } catch let error as URLError { precondition(error.code == .unsupportedURL) }
        }
        for payload in [["url": endpoint, "method": "GET", "body": "{}"],
                        ["url": endpoint, "method": "POST", "body": String(repeating: "x", count: 2_000_001)]] {
            do {
                _ = try await client.request(payload)
                fatalError("Invalid body was accepted")
            } catch let error as URLError { precondition(error.code == .dataLengthExceedsMaximum) }
        }
        let request = URLRequest(url: URL(string: endpoint)!)
        let response = HTTPURLResponse(url: request.url!, statusCode: 307, httpVersion: nil, headerFields: nil)!
        let task = URLSession.shared.dataTask(with: request)
        var called = false
        client.urlSession(URLSession.shared, task: task, willPerformHTTPRedirection: response,
                          newRequest: URLRequest(url: URL(string: "https://unrelated.example/receive")!)) { request in
            precondition(request == nil)
            called = true
        }
        precondition(called)
        task.cancel()
        print("Native boundary checks passed: destination, scheme, port, userinfo, fragment, API path, OAuth, live socket, methods, body bounds and redirects.")
    }
}
`);
  execFileSync("xcrun", ["swiftc", "-swift-version", "5", "-parse-as-library", file, "-o", binary], { stdio: "inherit" });
  execFileSync(binary, [], { stdio: "inherit" });
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
