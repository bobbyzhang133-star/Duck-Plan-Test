import SwiftUI
import WebKit

struct PlannerWebView: UIViewRepresentable {
    let alarms: TaskAlarmStore
    let notifications: TaskNotificationStore
    func makeCoordinator() -> Coordinator { Coordinator(alarms: alarms, notifications: notifications) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let bridge = "Object.defineProperty(window,'DuckNativeAlarms',{value:Object.freeze({request:body=>window.webkit.messageHandlers.duckAlarm.postMessage(body)}),writable:false,configurable:false});"
        configuration.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "duckAlarm")
        configuration.userContentController.addUserScript(WKUserScript(source: bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "duckNotification")
        let notificationBridge = "Object.defineProperty(window,'DuckNativeNotifications',{value:Object.freeze({request:body=>window.webkit.messageHandlers.duckNotification.postMessage(body)}),writable:false,configurable:false});"
        configuration.userContentController.addUserScript(WKUserScript(source: notificationBridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let webView = WKWebView(frame: .zero, configuration: configuration)
        context.coordinator.webView = webView
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "landing") {
            context.coordinator.allowedRoot = url.deletingLastPathComponent().standardizedFileURL
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return webView
    }
    func updateUIView(_ view: WKWebView, context: Context) { context.coordinator.deliverPendingNotification() }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate {
        let alarms: TaskAlarmStore
        let notifications: TaskNotificationStore
        weak var webView: WKWebView?
        private var openingNotification = false
        var allowedRoot: URL?
        init(alarms: TaskAlarmStore, notifications: TaskNotificationStore) {
            self.alarms = alarms
            self.notifications = notifications
            super.init()
            notifications.onOpen = { [weak self] in self?.deliverPendingNotification() }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { deliverPendingNotification() }

        func deliverPendingNotification() {
            guard !openingNotification, let webView, !webView.isLoading, allowed(webView.url),
                  let target = notifications.currentOpenTarget(),
                  let data = try? JSONSerialization.data(withJSONObject: ["taskId": target.taskID, "scope": target.scope]),
                  let payload = String(data: data, encoding: .utf8) else { return }
            openingNotification = true
            webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('duckplan:notification-open',{detail:\(payload)}))") { [weak self] _, error in
                Task { @MainActor in
                    guard let self else { return }
                    self.openingNotification = false
                    if error == nil { self.notifications.finishOpen(scope: target.scope, taskID: target.taskID) }
                }
            }
        }
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
                  let body = message.body as? [String: Any] else {
                replyHandler(nil, "This page cannot access native features."); return
            }
            if message.name == "duckNotification" {
                Task { @MainActor in
                    do {
                        guard let action = body["action"] as? String else { throw TaskNotificationError.invalid }
                        let expectedScope = body["scope"] as? String
                        if body["scope"] != nil && expectedScope == nil { throw TaskNotificationError.invalid }
                        switch action {
                        case "status":
                            await notifications.updatePermission()
                            replyHandler(["permission": notifications.permission], nil)
                        case "authorize":
                            try await notifications.authorize()
                            replyHandler(["permission": notifications.permission], nil)
                        case "list":
                            replyHandler(["notifications": try await notifications.list(expectedScope: expectedScope).map(\.bridgeValue)], nil)
                        case "context":
                            guard let scope = expectedScope, let ids = body["activeTaskIDs"] as? [String] else { throw TaskNotificationError.invalid }
                            try await notifications.context(scope: scope, activeTaskIDs: Set(ids))
                            replyHandler(["ok": true], nil)
                        case "schedule":
                            guard let taskID = body["taskID"] as? String, let title = body["title"] as? String,
                                  let fireAt = body["fireAt"] as? Double, fireAt.isFinite else { throw TaskNotificationError.invalid }
                            let record = try await notifications.save(taskID: taskID, title: title,
                                fireAt: Date(timeIntervalSince1970: fireAt / 1000), expectedScope: expectedScope)
                            replyHandler(["notification": record.bridgeValue], nil)
                        case "cancel":
                            guard let taskID = body["taskID"] as? String else { throw TaskNotificationError.invalid }
                            try notifications.cancel(taskID: taskID, expectedScope: expectedScope)
                            replyHandler(["ok": true], nil)
                        case "cancelAll":
                            try await notifications.cancelAll(expectedScope: expectedScope)
                            replyHandler(["ok": true], nil)
                        default: throw TaskNotificationError.invalid
                        }
                    } catch { replyHandler(nil, error.localizedDescription) }
                }
                return
            }
            guard message.name == "duckAlarm", let action = body["action"] as? String else {
                replyHandler(nil, "Unknown native feature."); return
            }
            Task { @MainActor in
                do {
                    let expectedScope = body["scope"] as? String
                    if body["scope"] != nil && expectedScope == nil { throw TaskAlarmError.invalid }
                    if action != "context" { try alarms.requireScope(expectedScope) }
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
                            fireAt: Date(timeIntervalSince1970: fireAt / 1000), sound: sound, snoozeMinutes: snooze,
                            expectedScope: body["scope"] as? String)
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
