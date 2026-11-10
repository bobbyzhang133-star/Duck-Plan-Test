import SwiftUI
import WebKit

struct PlannerWebView: UIViewRepresentable {
    let alarms: TaskAlarmStore
    func makeCoordinator() -> Coordinator { Coordinator(alarms: alarms) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let bridge = "Object.defineProperty(window,'DuckNativeAlarms',{value:Object.freeze({request:body=>window.webkit.messageHandlers.duckAlarm.postMessage(body)}),writable:false,configurable:false});"
        configuration.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "duckAlarm")
        configuration.userContentController.addUserScript(WKUserScript(source: bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "landing") {
            context.coordinator.allowedRoot = url.deletingLastPathComponent().standardizedFileURL
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return webView
    }
    func updateUIView(_ view: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate {
        let alarms: TaskAlarmStore
        var allowedRoot: URL?
        init(alarms: TaskAlarmStore) { self.alarms = alarms }
        func allowed(_ url: URL?) -> Bool {
            guard let url, url.isFileURL, let allowedRoot else { return false }
            return url.standardizedFileURL.path.hasPrefix(allowedRoot.path + "/")
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            // The native alarm bridge is available only to app-bundled documents.
            decisionHandler(allowed(navigationAction.request.url) ? .allow : .cancel)
        }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                                   replyHandler: @escaping (Any?, String?) -> Void) {
            guard message.frameInfo.isMainFrame, allowed(message.frameInfo.request.url),
                  let body = message.body as? [String: Any], let action = body["action"] as? String else {
                replyHandler(nil, "This page cannot access device alarms."); return
            }
            Task { @MainActor in
                do {
                    switch action {
                    case "status":
                        alarms.updatePermission()
                        replyHandler(["permission": alarms.permission], nil)
                    case "authorize":
                        try await alarms.authorize(); replyHandler(["permission": alarms.permission], nil)
                    case "list":
                        replyHandler(["alarms": try alarms.list().map(\.bridgeValue)], nil)
                    case "context":
                        guard let scope = body["scope"] as? String, scope.count <= 300,
                              let ids = body["activeTaskIDs"] as? [String], ids.count <= 10000 else { throw TaskAlarmError.invalid }
                        try alarms.context(scope: scope, activeTaskIDs: Set(ids)); replyHandler(["ok": true], nil)
                    case "schedule":
                        guard let taskID = body["taskID"] as? String, let title = body["title"] as? String,
                              let fireAt = body["fireAt"] as? Double, fireAt.isFinite,
                              let sound = body["sound"] as? String, let snooze = body["snoozeMinutes"] as? Int else { throw TaskAlarmError.invalid }
                        let record = try await alarms.save(taskID: taskID, title: title,
                            fireAt: Date(timeIntervalSince1970: fireAt / 1000), sound: sound, snoozeMinutes: snooze)
                        replyHandler(["alarm": record.bridgeValue], nil)
                    case "cancel":
                        guard let taskID = body["taskID"] as? String else { throw TaskAlarmError.invalid }
                        try alarms.cancel(taskID: taskID); replyHandler(["ok": true], nil)
                    case "cancelAll":
                        try alarms.cancelAll(); replyHandler(["ok": true], nil)
                    default: throw TaskAlarmError.invalid
                    }
                } catch { replyHandler(nil, error.localizedDescription) }
            }
        }
    }
}
