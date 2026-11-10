import ActivityKit
import AlarmKit
import CryptoKit
import SwiftUI

enum TaskAlarmError: LocalizedError {
    case invalid, denied, replacementFailed
    var errorDescription: String? {
        switch self {
        case .invalid: "Choose a task, a future alarm time, and a valid sound."
        case .denied: "Allow DuckPlan alarms in iPhone Settings, then try again."
        case .replacementFailed: "The alarm could not be replaced or restored. Please set it again."
        }
    }
}

@MainActor
final class TaskAlarmStore: ObservableObject {
    @Published private(set) var records: [TaskAlarmRecord] = []
    @Published private(set) var permission = "notDetermined"
    @Published private(set) var currentScope = "local"
    private let manager = AlarmManager.shared
    private let storageKey = "duckplan.native.task-alarms.v1"
    private var observation: Task<Void, Never>?
    private var replacements = Set<UUID>()

    init() {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let saved = try? JSONDecoder().decode([TaskAlarmRecord].self, from: data) { records = saved }
        updatePermission()
        observation = Task { [weak self] in
            guard let self else { return }
            for await alarms in self.manager.alarmUpdates {
                let ids = Set(alarms.map(\.id))
                self.records.removeAll { !ids.contains($0.id) && !self.replacements.contains($0.id) }
                self.persist()
                self.updatePermission()
            }
        }
    }

    func updatePermission() {
        switch manager.authorizationState {
        case .authorized: permission = "authorized"
        case .denied: permission = "denied"
        case .notDetermined: permission = "notDetermined"
        @unknown default: permission = "unavailable"
        }
    }

    func authorize() async throws {
        let state = try await manager.requestAuthorization()
        updatePermission()
        guard state == .authorized else { throw TaskAlarmError.denied }
    }

    func list() throws -> [TaskAlarmRecord] {
        updatePermission()
        guard permission == "authorized" else { return [] }
        let ids = Set(try manager.alarms.map(\.id))
        records.removeAll { !ids.contains($0.id) && !replacements.contains($0.id) }
        persist()
        updatePermission()
        return records.filter { $0.scope == currentScope }.sorted { $0.fireAt < $1.fireAt }
    }

    func context(scope: String, activeTaskIDs: Set<String>) throws {
        // Changing account or signing out clears the previous account's local alarms.
        for record in records where record.scope != scope || !activeTaskIDs.contains(record.taskID) {
            try cancel(id: record.id)
        }
        currentScope = scope
    }

    func save(taskID: String, title: String, fireAt: Date, sound: String, snoozeMinutes: Int) async throws -> TaskAlarmRecord {
        guard !taskID.isEmpty, taskID.count <= 200, !title.isEmpty, title.count <= 300,
              fireAt.timeIntervalSinceNow >= 5, fireAt.timeIntervalSinceNow <= 366 * 86400,
              ["system", "gentle", "bright"].contains(sound), [0, 5, 10, 15].contains(snoozeMinutes) else {
            throw TaskAlarmError.invalid
        }
        if manager.authorizationState != .authorized { try await authorize() }
        let digest = Array(SHA256.hash(data: Data((currentScope + ":" + taskID).utf8)))
        let id = UUID(uuid: (digest[0],digest[1],digest[2],digest[3],digest[4],digest[5],digest[6],digest[7],digest[8],digest[9],digest[10],digest[11],digest[12],digest[13],digest[14],digest[15]))
        let previous = records.first { $0.id == id }
        replacements.insert(id)
        defer { replacements.remove(id) }
        let record = TaskAlarmRecord(id: id, scope: currentScope, taskID: taskID, title: title,
                                     fireAt: fireAt, sound: sound, snoozeMinutes: snoozeMinutes)
        if try manager.alarms.contains(where: { $0.id == id }) { try manager.cancel(id: id) }
        do { try await schedule(record) }
        catch {
            if let previous, previous.fireAt > Date() {
                do { try await schedule(previous) }
                catch { records.removeAll { $0.id == id }; persist(); throw TaskAlarmError.replacementFailed }
            }
            throw error
        }
        records.removeAll { $0.id == id }
        records.append(record)
        persist()
        return record
    }

    private func schedule(_ record: TaskAlarmRecord) async throws {
        let title = LocalizedStringResource(stringLiteral: record.title)
        let stop = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.fill")
        let snooze = AlarmButton(text: "Snooze", textColor: .white, systemImageName: "zzz")
        let alert = AlarmPresentation.Alert(title: title, stopButton: stop,
            secondaryButton: record.snoozeMinutes > 0 ? snooze : nil,
            secondaryButtonBehavior: record.snoozeMinutes > 0 ? .countdown : nil)
        let presentation = record.snoozeMinutes > 0
            ? AlarmPresentation(alert: alert, countdown: .init(title: title))
            : AlarmPresentation(alert: alert)
        let attributes = AlarmAttributes(presentation: presentation,
            metadata: TaskAlarmMetadata(taskID: record.taskID, title: record.title), tintColor: .orange)
        let sound: AlertConfiguration.AlertSound = record.sound == "system" ? .default : .named(record.sound + ".wav")
        let configuration = AlarmManager.AlarmConfiguration(
            countdownDuration: record.snoozeMinutes > 0 ? Alarm.CountdownDuration(preAlert: nil, postAlert: Double(record.snoozeMinutes * 60)) : nil,
            schedule: .fixed(record.fireAt), attributes: attributes, sound: sound)
        _ = try await manager.schedule(id: record.id, configuration: configuration)
    }

    func cancel(taskID: String) throws {
        for record in records where record.scope == currentScope && record.taskID == taskID { try cancel(id: record.id) }
    }

    func cancelAll() throws {
        for record in records { try cancel(id: record.id) }
    }

    func cancel(id: UUID) throws {
        if try manager.alarms.contains(where: { $0.id == id }) { try manager.cancel(id: id) }
        records.removeAll { $0.id == id }
        persist()
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(records) { UserDefaults.standard.set(data, forKey: storageKey) }
    }
}
