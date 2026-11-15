import Foundation
import UIKit

@MainActor
final class NativeAlertOperationQueue {
    static let shared = NativeAlertOperationQueue()
    private var tail = Task<Void, Never> {}
    func run<T>(_ operation: @escaping @MainActor () async throws -> T) async throws -> T {
        let previous = tail
        let next = Task { @MainActor in await previous.value; return try await operation() }
        tail = Task { _ = try? await next.value }
        return try await next.value
    }
}

@MainActor
final class NativeSyncDeviceState: NativeSyncPersistence {
    static let shared = NativeSyncDeviceState()
    private let defaults = UserDefaults.standard
    private let ownerKey = "duckplan.native.sync.owner.v1"
    private var snapshotURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("DuckPlan", isDirectory: true).appendingPathComponent("planner-snapshot.json")
    }
    var owner: String? {
        get { defaults.string(forKey: ownerKey) }
        set { defaults.set(newValue, forKey: ownerKey) }
    }
    var installationID: String {
        let key = "duckplan.native.sync.installation.v1"
        if let value = defaults.string(forKey: key), UUID(uuidString: value) != nil { return value }
        let value = UUID().uuidString.lowercased(); defaults.set(value, forKey: key); return value
    }
    func choice(_ channel: String, scope: String) -> Bool? {
        defaults.object(forKey: "duckplan.native.sync.choice.v1:\(scope):\(channel)") as? Bool
    }
    func enabled(_ channel: String, scope: String) -> Bool {
        // A legacy WKWebView pause choice must be mirrored once before background delivery.
        choice(channel, scope: scope) ?? false
    }
    func setEnabled(_ enabled: Bool, channel: String, scope: String) {
        guard ["alarm", "notification"].contains(channel), !scope.isEmpty, scope.count <= 300 else { return }
        defaults.set(enabled, forKey: "duckplan.native.sync.choice.v1:\(scope):\(channel)")
    }
    func cache(_ data: Data, owner: String) throws {
        guard self.owner == owner else { throw NativeSyncError.accountChanged }
        let directory = snapshotURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let envelope = try JSONSerialization.data(withJSONObject: ["owner": owner, "fetchedAt": Date().timeIntervalSince1970,
            "planner": NativeSyncDomain.object(data)])
        try envelope.write(to: snapshotURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
    func removeSnapshot() { try? FileManager.default.removeItem(at: snapshotURL) }
}

@MainActor
private final class NativeSyncSystemProviders: NativeSyncProviders {
    let alarms: TaskAlarmStore
    let notifications: TaskNotificationStore
    let state = NativeSyncDeviceState.shared
    init(alarms: TaskAlarmStore, notifications: TaskNotificationStore) { self.alarms = alarms; self.notifications = notifications }
    func clear() async throws {
        try await NativeAlertOperationQueue.shared.run { [self] in
            try alarms.context(scope: "local", activeTaskIDs: [])
            try await notifications.context(scope: "local", activeTaskIDs: [])
        }
    }
    func apply(_ tasks: [NativeSyncTask], scope: String, current: @escaping () -> Bool) async throws -> NativeSyncApplyResult {
        try await NativeAlertOperationQueue.shared.run { [self] in
            guard current() else { throw NativeSyncError.accountChanged }
            let active = Set(tasks.filter(\.active).map(\.id))
            try alarms.context(scope: scope, activeTaskIDs: active)
            guard current() else { throw NativeSyncError.accountChanged }
            try await notifications.context(scope: scope, activeTaskIDs: active)
            guard current() else { throw NativeSyncError.accountChanged }
            alarms.refreshRingingAlarms(); await notifications.updatePermission()
            guard current() else { throw NativeSyncError.accountChanged }
            let pendingAlarms = (try? alarms.list()) ?? []
            let pendingNotifications = (try? await notifications.list(expectedScope: scope)) ?? []
            guard current() else { throw NativeSyncError.accountChanged }
            var registered = 0, needsAttention = false
            for task in tasks where task.configured {
                guard current(), alarms.currentScope == scope, notifications.currentScope == scope else { throw NativeSyncError.accountChanged }
                do {
                let choice = state.choice("alarm", scope: scope)
                let ringing = alarms.records.first { $0.scope == scope && $0.taskID == task.id && alarms.inProgressAlarmIDs.contains($0.id) }
                if choice == nil { needsAttention = true }
                else if NativeSyncDomain.preserveRinging(task, fireAt: ringing?.fireAt, alerting: ringing != nil, deviceEnabled: choice == true) { registered += 1 }
                else if choice == false || task.alarm == nil { try alarms.cancel(taskID: task.id) }
                else if alarms.permission == "authorized", let delivery = task.alarm {
                    let old = pendingAlarms.first { $0.scope == scope && $0.taskID == task.id }
                    if old?.fireAt != delivery.fireAt || old?.title != delivery.title || old?.sound != delivery.sound || old?.snoozeMinutes != delivery.snoozeMinutes {
                        _ = try await alarms.save(taskID: delivery.taskID, title: delivery.title, fireAt: delivery.fireAt,
                            sound: delivery.sound, snoozeMinutes: delivery.snoozeMinutes, expectedScope: scope, allowAuthorization: false)
                    }
                    registered += 1
                } else { needsAttention = true }
                } catch { needsAttention = true }
                guard current() else { throw NativeSyncError.accountChanged }
                do {
                let choice = state.choice("notification", scope: scope)
                if choice == nil { needsAttention = true }
                else if choice == false || task.notification == nil { try notifications.cancel(taskID: task.id, expectedScope: scope) }
                else if notifications.permission == "authorized", let delivery = task.notification {
                    let old = pendingNotifications.first { $0.scope == scope && $0.taskID == task.id }
                    if old?.fireAt != delivery.fireAt || old?.title != delivery.title {
                        _ = try await notifications.save(taskID: delivery.taskID, title: delivery.title, fireAt: delivery.fireAt,
                            expectedScope: scope, allowAuthorization: false)
                    }
                    registered += 1
                } else { needsAttention = true }
                } catch { needsAttention = true }
            }
            guard current() else { throw NativeSyncError.accountChanged }
            return NativeSyncApplyResult(scheduledCount: registered, needsAttention: needsAttention)
        }
    }
}

@MainActor
final class NativeBackgroundSync {
    static let shared = NativeBackgroundSync()
    let cloud = NativeCloudClient()
    let alarms = TaskAlarmStore()
    let notifications = TaskNotificationStore.shared
    private lazy var engine = NativeSyncEngine(transport: cloud,
        providers: NativeSyncSystemProviders(alarms: alarms, notifications: notifications), persistence: NativeSyncDeviceState.shared)
    private var deviceToken: String?
    private var sessionObservation = NativeSyncSessionObservation()
    private var activation = Task<Void, Never> {}
    var onSnapshot: (() -> Void)?
    var onStatus: (() -> Void)?
    var status: [String: Any] { engine.status }
    private var environment: String {
        Bundle.main.object(forInfoDictionaryKey: "DuckPlanAPNSEnvironment") as? String == "production" ? "production" : "sandbox"
    }
    private var pushConfigured: Bool { Bundle.main.object(forInfoDictionaryKey: "DuckPlanBackgroundSyncEnabled") as? String == "YES" }
    func receiveToken(_ data: Data) {
        // Retain only the current APNs callback value; never persist or send it to JavaScript.
        deviceToken = data.map { String(format: "%02x", $0) }.joined()
        Task { if pushConfigured, let token = deviceToken { await engine.register(token: token, environment: environment) }; onStatus?() }
    }
    func registrationFailed() { deviceToken = nil; engine.registrationFailed(); onStatus?() }
    func foreground() {
        activation.cancel()
        activation = Task {
            let changed = await engine.synchronize()
            guard !Task.isCancelled else { return }
            if pushConfigured {
                if engine.scope != nil { UIApplication.shared.registerForRemoteNotifications() }
                if let token = deviceToken { await engine.register(token: token, environment: environment) }
            } else { engine.pushNotConfigured() }
            onStatus?()
            if changed { onSnapshot?() }
        }
    }
    func mirrorChoice(_ body: [String: Any], channel: String, authorized: Bool = false) {
        guard ["context", "cancelAll"].contains(body["action"] as? String ?? "") || authorized else { return }
        guard let scope = body["scope"] as? String, let enabled = NativeSyncDomain.boolean(body["deviceEnabled"]) else { return }
        guard NativeSyncDeviceState.shared.choice(channel, scope: scope) != enabled else { return }
        engine.invalidateInFlight()
        NativeSyncDeviceState.shared.setEnabled(enabled, channel: channel, scope: scope)
        if UIApplication.shared.applicationState == .active { foreground() }
    }
    func route(_ body: [String: Any]) async throws -> [String: Any] {
        let path = (body["url"] as? String).flatMap(URL.init(string:))?.path ?? ""
        let url = (body["url"] as? String).flatMap(URL.init(string:))
        let nativeOrigin = url?.scheme == cloud.apiURL.scheme && url?.host == cloud.apiURL.host && url?.port == cloud.apiURL.port && url?.user == nil && url?.password == nil && url?.fragment == nil
        let mutation = nativeOrigin && body["method"] as? String == "POST" && ["/api/auth/sign-in", "/api/auth/sign-up", "/api/auth/recover", "/api/auth/sign-out"].contains(path)
        if mutation { activation.cancel(); sessionObservation.reset(); await engine.prepareAccountChange(unregister: true) }
        do {
            let result = try await cloud.request(body)
            if mutation { engine.resumeAfterAccountRequest() }
            if mutation { foreground() }
            else if path == "/api/session", let status = result["status"] as? Int, [200, 401].contains(status),
                    let text = result["body"] as? String, let data = text.data(using: .utf8) {
                let owner = status == 401 ? nil : try NativeSyncDomain.scope(data)
                if sessionObservation.observe(owner) { foreground() }
            }
            return result
        } catch {
            if mutation { engine.resumeAfterAccountRequest(); foreground() }
            throw error
        }
    }
    func receiveRemote(_ payload: [AnyHashable: Any], completion: @escaping (UIBackgroundFetchResult) -> Void) {
        guard (payload["duckplan_sync"] as? NSNumber)?.intValue == 1,
              let aps = payload["aps"] as? [String: Any], (aps["content-available"] as? NSNumber)?.intValue == 1 else { completion(.noData); return }
        var completed = false
        let operation = Task { @MainActor in
            let changed = await engine.synchronize()
            guard !completed else { return }; completed = true
            if changed { onSnapshot?() }
            onStatus?()
            completion(changed ? .newData : engine.lastAttemptSucceeded ? .noData : .failed)
        }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(25))
            guard !completed else { return }; completed = true
            operation.cancel(); engine.invalidateInFlight(); completion(.failed)
        }
    }
}

extension NativeCloudClient: NativeSyncTransport {
    func send(method: String, path: String, body: [String: Any]?) async throws -> NativeSyncResponse {
        guard path.hasPrefix("/"), !path.hasPrefix("//") else { throw URLError(.unsupportedURL) }
        var request: [String: Any] = ["url": apiURL.absoluteString + path, "method": method]
        if let body { request["body"] = String(data: try JSONSerialization.data(withJSONObject: body), encoding: .utf8) }
        let result = try await self.request(request, timeout: 7)
        guard let status = result["status"] as? Int, let text = result["body"] as? String, let data = text.data(using: .utf8) else { throw URLError(.badServerResponse) }
        return NativeSyncResponse(status: status, data: data)
    }
}
