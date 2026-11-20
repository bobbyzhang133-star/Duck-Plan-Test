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
        configuration.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "duckCloud")
        let cloud = "Object.defineProperty(window,'DuckNativeCloud',{value:Object.freeze({apiUrl:'\(context.coordinator.cloud.apiURL.absoluteString)',request:body=>window.webkit.messageHandlers.duckCloud.postMessage(body)}),writable:false,configurable:false});"
        configuration.userContentController.addUserScript(WKUserScript(source: cloud, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "duckSync")
        let sync = "Object.defineProperty(window,'DuckNativeSync',{value:Object.freeze({request:body=>window.webkit.messageHandlers.duckSync.postMessage(body)}),writable:false,configurable:false});"
        configuration.userContentController.addUserScript(WKUserScript(source: sync, injectionTime: .atDocumentStart, forMainFrameOnly: true))
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
        let cloud = NativeBackgroundSync.shared.cloud
        var allowedRoot: URL?
        init(alarms: TaskAlarmStore, notifications: TaskNotificationStore) {
            self.alarms = alarms
            self.notifications = notifications
            super.init()
            notifications.onOpen = { [weak self] in self?.deliverPendingNotification() }
            NativeBackgroundSync.shared.onSnapshot = { [weak self] in
                self?.webView?.evaluateJavaScript("window.dispatchEvent(new Event('duckplan:native-sync-updated'))", completionHandler: nil)
            }
            NativeBackgroundSync.shared.onStatus = { [weak self] in
                self?.webView?.evaluateJavaScript("window.dispatchEvent(new Event('duckplan:native-sync-status'))", completionHandler: nil)
            }
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
            if message.name == "duckCloud" {
                Task { @MainActor in
                    do { replyHandler(try await NativeBackgroundSync.shared.route(body), nil) }
                    catch { replyHandler(nil, "Couldn't reach DuckPlan. Check your connection and try again.") }
                }
                return
            }
            if message.name == "duckSync" {
                guard let action = body["action"] as? String, ["status", "refresh"].contains(action) else { replyHandler(nil, "Unknown sync action."); return }
                if action == "refresh" { NativeBackgroundSync.shared.foreground() }
                replyHandler(NativeBackgroundSync.shared.status, nil)
                return
            }
            if message.name == "duckNotification" {
                NativeBackgroundSync.shared.mirrorChoice(body, channel: "notification")
                Task { @MainActor in
                    do {
                        try await NativeAlertOperationQueue.shared.run { [self] in
                            guard let action = body["action"] as? String else { throw TaskNotificationError.invalid }
                            let expectedScope = body["scope"] as? String
                            if body["scope"] != nil && expectedScope == nil { throw TaskNotificationError.invalid }
                            switch action {
                            case "status":
                                await notifications.updatePermission()
                                replyHandler(["permission": notifications.permission], nil)
                            case "authorize":
                                try await notifications.authorize()
                                NativeBackgroundSync.shared.mirrorChoice(body, channel: "notification", authorized: true)
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
                        }
                    } catch { replyHandler(nil, error.localizedDescription) }
                }
                return
            }
            guard message.name == "duckAlarm", let action = body["action"] as? String else {
                replyHandler(nil, "Unknown native feature."); return
            }
            NativeBackgroundSync.shared.mirrorChoice(body, channel: "alarm")
            Task { @MainActor in
                do {
                    try await NativeAlertOperationQueue.shared.run { [self] in
                        let expectedScope = body["scope"] as? String
                        if body["scope"] != nil && expectedScope == nil { throw TaskAlarmError.invalid }
                        if action != "context" { try alarms.requireScope(expectedScope) }
                        switch action {
                        case "status":
                            alarms.updatePermission()
                            replyHandler(["permission": alarms.permission], nil)
                        case "authorize":
                            try await alarms.authorize()
                            NativeBackgroundSync.shared.mirrorChoice(body, channel: "alarm", authorized: true)
                            replyHandler(["permission": alarms.permission], nil)
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
                    }
                } catch { replyHandler(nil, error.localizedDescription) }
            }
        }
    }
}

// Only the bundled main frame can use this client. Cookies stay in native storage,
// never in a JavaScript reply; the public Worker's CORS/CSRF policy stays intact.
final class NativeCloudClient: NSObject, URLSessionTaskDelegate {
    let apiURL: URL
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = .shared
        configuration.httpShouldSetCookies = true
        configuration.httpCookieAcceptPolicy = .always
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 30
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    override init() {
        var endpoint = URL(string: "https://duckplan-latest.ocs-learning.workers.dev/api")!
        #if DEBUG && targetEnvironment(simulator)
        // Local fixture only. Physical-device and Release builds always use HTTPS production.
        if let value = ProcessInfo.processInfo.environment["DUCKPLAN_NATIVE_API_URL"],
           let candidate = URL(string: value), candidate.scheme == "http",
           candidate.host == "127.0.0.1", candidate.path == "/api",
           candidate.user == nil, candidate.password == nil,
           candidate.query == nil, candidate.fragment == nil {
            endpoint = candidate
        }
        #endif
        apiURL = endpoint
        super.init()
    }

    func request(_ body: [String: Any], timeout: TimeInterval = 30) async throws -> [String: Any] {
        guard let address = body["url"] as? String, let url = URL(string: address),
              url.scheme == apiURL.scheme, url.host == apiURL.host, url.port == apiURL.port,
              url.user == nil, url.password == nil, url.fragment == nil,
              url.path.hasPrefix("/api/"), !url.path.hasPrefix("/api/auth/google"), url.path != "/api/live",
              let method = body["method"] as? String,
              ["GET", "POST", "PUT", "PATCH", "DELETE"].contains(method) else {
            throw URLError(.unsupportedURL)
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = timeout
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let payload = body["body"] as? String {
            guard method != "GET", payload.utf8.count <= 2_000_000 else { throw URLError(.dataLengthExceedsMaximum) }
            request.httpBody = Data(payload.utf8)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse, data.count <= 8_000_000 else { throw URLError(.badServerResponse) }
        if response.statusCode == 204 { return ["status": 204, "body": ""] }
        guard
              response.value(forHTTPHeaderField: "Content-Type")?.lowercased().contains("application/json") == true,
              let text = String(data: data, encoding: .utf8) else { throw URLError(.badServerResponse) }
        return ["status": response.statusCode, "body": text]
    }

    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        // Never forward a password, session cookie or planner data to a redirect target.
        completionHandler(nil)
    }
}
