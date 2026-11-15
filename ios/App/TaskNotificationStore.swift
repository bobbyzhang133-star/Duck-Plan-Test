import Combine
import CryptoKit
import Foundation
import UserNotifications

enum TaskNotificationError: LocalizedError {
    case invalid, denied, contextChanged
    var errorDescription: String? {
        switch self {
        case .invalid: "Choose an active task and a notification time between now and one year ahead."
        case .denied: "Allow DuckPlan notifications in iPhone Settings, then try again."
        case .contextChanged: "The planner account changed. Open the task again before saving its notification."
        }
    }
}

struct TaskNotificationRecord: Codable, Identifiable, Sendable {
    var id: String
    var scope: String
    var taskID: String
    var title: String
    var fireAt: Date
    var timeZone: String

    var bridgeValue: [String: Any] {
        ["item_id": taskID, "title": title, "fire_at": fireAt.timeIntervalSince1970 * 1000, "time_zone": timeZone]
    }
}

// The narrow client permits compiled boundary tests without scheduling on a user's device.
@MainActor
protocol TaskNotificationClient: AnyObject {
    func authorization() async -> UNAuthorizationStatus
    func authorize() async throws -> Bool
    func pending() async -> [UNNotificationRequest]
    func deliveredIDs() async -> [String]
    func add(_ request: UNNotificationRequest) async throws
    func removePending(_ identifiers: [String])
    func removeDelivered(_ identifiers: [String])
}

@MainActor
private final class SystemTaskNotificationClient: TaskNotificationClient {
    private let center = UNUserNotificationCenter.current()
    func authorization() async -> UNAuthorizationStatus { await center.notificationSettings().authorizationStatus }
    func authorize() async throws -> Bool { try await center.requestAuthorization(options: [.alert, .sound, .badge]) }
    func pending() async -> [UNNotificationRequest] { await center.pendingNotificationRequests() }
    func deliveredIDs() async -> [String] { await center.deliveredNotifications().map { $0.request.identifier } }
    func add(_ request: UNNotificationRequest) async throws { try await center.add(request) }
    func removePending(_ identifiers: [String]) { center.removePendingNotificationRequests(withIdentifiers: identifiers) }
    func removeDelivered(_ identifiers: [String]) { center.removeDeliveredNotifications(withIdentifiers: identifiers) }
}

protocol TaskNotificationPersistence: AnyObject {
    func data(forKey key: String) -> Data?
    func set(_ value: Any?, forKey key: String)
}

extension UserDefaults: TaskNotificationPersistence {}

@MainActor
final class TaskNotificationStore: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    static let shared = TaskNotificationStore()
    static let identifierPrefix = "duckplan.task-notification."
    @Published private(set) var records: [TaskNotificationRecord] = []
    @Published private(set) var permission = "notDetermined"
    @Published private(set) var currentScope = "local"
    private(set) var contextReady = false
    private(set) var contextGeneration = 0
    private var activeTaskIDs = Set<String>()
    private let client: TaskNotificationClient
    private let defaults: TaskNotificationPersistence
    private let storageKey: String
    var onOpen: (() -> Void)?
    private(set) var pendingOpen: (scope: String, taskID: String)?

    init(client: TaskNotificationClient? = nil, defaults: TaskNotificationPersistence = UserDefaults.standard,
         storageKey: String = "duckplan.native.task-notifications.v1") {
        self.client = client ?? SystemTaskNotificationClient()
        self.defaults = defaults
        self.storageKey = storageKey
        super.init()
        if let data = defaults.data(forKey: storageKey),
           let saved = try? JSONDecoder().decode([TaskNotificationRecord].self, from: data) { records = saved }
    }

    func installDelegate() { UNUserNotificationCenter.current().delegate = self }

    static func identifier(scope: String, taskID: String) -> String {
        let digest = SHA256.hash(data: Data((scope + ":" + taskID).utf8))
        return identifierPrefix + digest.map { String(format: "%02x", $0) }.joined()
    }

    func updatePermission() async {
        switch await client.authorization() {
        case .authorized, .provisional, .ephemeral: permission = "authorized"
        case .denied: permission = "denied"
        case .notDetermined: permission = "notDetermined"
        @unknown default: permission = "unavailable"
        }
    }

    func authorize() async throws {
        await updatePermission()
        if permission == "authorized" { return }
        guard permission == "notDetermined" else { throw TaskNotificationError.denied }
        let allowed = try await client.authorize()
        await updatePermission()
        guard allowed, permission == "authorized" else { throw TaskNotificationError.denied }
    }

    func requireScope(_ expectedScope: String?) throws {
        if let expectedScope, expectedScope != currentScope { throw TaskNotificationError.contextChanged }
    }

    private func validContext(_ generation: Int, scope: String, taskID: String) -> Bool {
        contextReady && generation == contextGeneration && scope == currentScope && activeTaskIDs.contains(taskID)
    }

    func list(expectedScope: String? = nil) async throws -> [TaskNotificationRecord] {
        try requireScope(expectedScope)
        let generation = contextGeneration
        await updatePermission()
        let requests = await client.pending()
        guard generation == contextGeneration else { throw TaskNotificationError.contextChanged }
        recover(requests)
        let ids = Set(requests.map(\.identifier))
        return records.filter { $0.scope == currentScope && activeTaskIDs.contains($0.taskID) && ids.contains($0.id) }
            .sorted { $0.fireAt < $1.fireAt }
    }

    func context(scope: String, activeTaskIDs: Set<String>) async throws {
        guard !scope.isEmpty, scope.count <= 300, activeTaskIDs.count <= 10000,
              activeTaskIDs.allSatisfy({ !$0.isEmpty && $0.count <= 200 }) else { throw TaskNotificationError.invalid }
        let scopeChanged = !contextReady || scope != currentScope
        if scopeChanged || activeTaskIDs != self.activeTaskIDs { contextGeneration &+= 1 }
        currentScope = scope
        self.activeTaskIDs = activeTaskIDs
        contextReady = true
        let generation = contextGeneration
        let requests = await client.pending()
        guard generation == contextGeneration else { return }
        recover(requests)
        let retiring = records.filter { $0.scope != scope || !activeTaskIDs.contains($0.taskID) }.map(\.id)
        client.removePending(retiring)
        client.removeDelivered(retiring)
        records.removeAll { retiring.contains($0.id) }
        if scopeChanged {
            let delivered = await client.deliveredIDs()
            guard generation == contextGeneration else { return }
            client.removeDelivered(delivered.filter { $0.hasPrefix(Self.identifierPrefix) })
        }
        if let target = pendingOpen, target.scope != scope || !activeTaskIDs.contains(target.taskID) { pendingOpen = nil }
        persist()
        onOpen?()
    }

    func save(taskID: String, title: String, fireAt: Date, expectedScope: String? = nil, allowAuthorization: Bool = true) async throws -> TaskNotificationRecord {
        guard !taskID.isEmpty, taskID.count <= 200, !title.isEmpty, title.count <= 300,
              fireAt.timeIntervalSinceNow >= 5, fireAt.timeIntervalSinceNow <= 366 * 86400 else { throw TaskNotificationError.invalid }
        try requireScope(expectedScope)
        let scope = currentScope, generation = contextGeneration
        guard validContext(generation, scope: scope, taskID: taskID) else { throw TaskNotificationError.contextChanged }
        if allowAuthorization { try await authorize() }
        else { await updatePermission(); guard permission == "authorized" else { throw TaskNotificationError.denied } }
        guard validContext(generation, scope: scope, taskID: taskID) else { throw TaskNotificationError.contextChanged }
        let id = Self.identifier(scope: scope, taskID: taskID)
        let record = TaskNotificationRecord(id: id, scope: scope, taskID: taskID, title: title,
                                            fireAt: fireAt, timeZone: TimeZone.current.identifier)
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = "It’s time to start this task."
        content.sound = .default
        content.userInfo = ["duckplan_channel": "task-start", "duckplan_scope": scope, "duckplan_task_id": taskID,
                            "duckplan_fire_at": fireAt.timeIntervalSince1970 * 1000, "duckplan_time_zone": record.timeZone]
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        var components = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: fireAt)
        components.calendar = calendar
        components.timeZone = calendar.timeZone
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        // Replacing the same identifier through add preserves the previous pending request if add fails.
        try await client.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
        guard validContext(generation, scope: scope, taskID: taskID) else {
            client.removePending([id]); client.removeDelivered([id])
            throw TaskNotificationError.contextChanged
        }
        records.removeAll { $0.id == id }
        records.append(record)
        persist()
        return record
    }

    func cancel(taskID: String, expectedScope: String? = nil) throws {
        try requireScope(expectedScope)
        guard !taskID.isEmpty, taskID.count <= 200 else { throw TaskNotificationError.invalid }
        let id = Self.identifier(scope: currentScope, taskID: taskID)
        client.removePending([id]); client.removeDelivered([id])
        records.removeAll { $0.id == id }
        if pendingOpen?.scope == currentScope && pendingOpen?.taskID == taskID { pendingOpen = nil }
        persist()
    }

    func cancelAll(expectedScope: String? = nil) async throws {
        try requireScope(expectedScope)
        let generation = contextGeneration
        let requests = await client.pending(), delivered = await client.deliveredIDs()
        guard generation == contextGeneration else { throw TaskNotificationError.contextChanged }
        let ids = Set(records.map(\.id) + requests.map(\.identifier) + delivered).filter { $0.hasPrefix(Self.identifierPrefix) }
        client.removePending(Array(ids)); client.removeDelivered(Array(ids))
        records.removeAll(); pendingOpen = nil
        persist()
    }

    private func recover(_ requests: [UNNotificationRequest]) {
        for request in requests {
            let info = request.content.userInfo
            guard info["duckplan_channel"] as? String == "task-start",
                  let scope = info["duckplan_scope"] as? String, let taskID = info["duckplan_task_id"] as? String,
                  let milliseconds = info["duckplan_fire_at"] as? Double, milliseconds.isFinite,
                  !scope.isEmpty, scope.count <= 300, !taskID.isEmpty, taskID.count <= 200,
                  request.identifier == Self.identifier(scope: scope, taskID: taskID) else { continue }
            records.removeAll { $0.id == request.identifier }
            records.append(TaskNotificationRecord(id: request.identifier, scope: scope, taskID: taskID,
                title: request.content.title, fireAt: Date(timeIntervalSince1970: milliseconds / 1000),
                timeZone: info["duckplan_time_zone"] as? String ?? TimeZone.current.identifier))
        }
    }

    func queueOpen(scope: String, taskID: String) {
        guard !scope.isEmpty, scope.count <= 300, !taskID.isEmpty, taskID.count <= 200 else { return }
        pendingOpen = (scope, taskID)
        if contextReady {
            guard scope == currentScope && activeTaskIDs.contains(taskID) else { pendingOpen = nil; return }
            onOpen?()
        }
    }

    func currentOpenTarget() -> (scope: String, taskID: String)? {
        guard contextReady, let target = pendingOpen, target.scope == currentScope,
              activeTaskIDs.contains(target.taskID) else { return nil }
        return target
    }

    func finishOpen(scope: String, taskID: String) {
        if pendingOpen?.scope == scope && pendingOpen?.taskID == taskID { pendingOpen = nil }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(records) { defaults.set(data, forKey: storageKey) }
    }

    func presentationOptions(for request: UNNotificationRequest) -> UNNotificationPresentationOptions {
        let info = request.content.userInfo
        guard contextReady, info["duckplan_channel"] as? String == "task-start",
              let scope = info["duckplan_scope"] as? String, let taskID = info["duckplan_task_id"] as? String,
              scope == currentScope, activeTaskIDs.contains(taskID),
              request.identifier == Self.identifier(scope: scope, taskID: taskID) else { return [] }
        return [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                           withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let request = notification.request
        Task { @MainActor in completionHandler(self.presentationOptions(for: request)) }
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                           withCompletionHandler completionHandler: @escaping () -> Void) {
        let request = response.notification.request
        let scope = request.content.userInfo["duckplan_scope"] as? String
        let taskID = request.content.userInfo["duckplan_task_id"] as? String
        let identifier = request.identifier
        let action = response.actionIdentifier
        Task { @MainActor in
            if action == UNNotificationDefaultActionIdentifier, let scope, let taskID,
               identifier == Self.identifier(scope: scope, taskID: taskID) { self.queueOpen(scope: scope, taskID: taskID) }
            completionHandler()
        }
    }
}
