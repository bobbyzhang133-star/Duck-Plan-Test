import Foundation
import CoreFoundation

enum NativeSyncError: LocalizedError {
    case invalidSnapshot, accountChanged, unavailable, permission, paused
    var errorDescription: String? {
        switch self {
        case .invalidSnapshot: "DuckPlan could not read the updated planner safely. Open the app to refresh."
        case .accountChanged: "The signed-in account changed during background sync."
        case .unavailable: "Background sync is awaiting server activation."
        case .permission: "Allow alarms and notifications on this device to deliver saved alerts."
        case .paused: "Alerts are paused on this device."
        }
    }
}

struct NativeSyncDelivery: Equatable {
    var taskID: String
    var title: String
    var fireAt: Date
    var timeZone: String
    var sound: String = "system"
    var snoozeMinutes: Int = 5
}

struct NativeSyncTask {
    var id: String
    var configured: Bool
    var active: Bool
    var alarm: NativeSyncDelivery?
    var notification: NativeSyncDelivery?
    var alarmEnabled = false
    var alarmTarget: Date?
}
struct NativeSyncSessionObservation {
    private var observed = false
    private var owner: String?
    mutating func observe(_ next: String?) -> Bool {
        let changed = !observed || next != owner
        observed = true; owner = next
        return changed
    }
    mutating func reset() { observed = false; owner = nil }
}

// The same persisted wall-time contract as work-alerts.js, independent of WebKit.
// Invalid snapshots fail before any cancellation or scheduling takes place.
enum NativeSyncDomain {
    static func preserveRinging(_ task: NativeSyncTask, fireAt: Date?, alerting: Bool, deviceEnabled: Bool) -> Bool {
        task.active && task.configured && task.alarmEnabled && deviceEnabled && alerting && fireAt != nil && task.alarmTarget == fireAt
    }
    static func object(_ data: Data) throws -> [String: Any] {
        guard data.count <= 8_000_000, let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw NativeSyncError.invalidSnapshot }
        return value
    }
    static func scope(_ data: Data) throws -> String? {
        let value = try object(data)
        guard let user = value["user"] else { throw NativeSyncError.invalidSnapshot }
        if user is NSNull { return nil }
        guard let id = (user as? [String: Any])?["id"] as? String, !id.isEmpty, id.count <= 300, id != "local" else { throw NativeSyncError.invalidSnapshot }
        return id
    }
    static func boolean(_ value: Any?) -> Bool? {
        guard let value = value as? NSNumber, CFGetTypeID(value) == CFBooleanGetTypeID() else { return nil }
        return value.boolValue
    }
    static func wallDate(_ value: String, zone: String) throws -> Date {
        guard value.count == 16, let timeZone = TimeZone(identifier: zone) else { throw NativeSyncError.invalidSnapshot }
        let pieces = value.split(separator: "T"), date = pieces.first?.split(separator: "-"), time = pieces.last?.split(separator: ":")
        guard pieces.count == 2, let date, let time, date.count == 3, time.count == 2,
              date[0].count == 4, date[1].count == 2, date[2].count == 2, time[0].count == 2, time[1].count == 2,
              let y = Int(date[0]), let m = Int(date[1]), let d = Int(date[2]), let h = Int(time[0]), let minute = Int(time[1]),
              y > 0, (1...12).contains(m), (1...31).contains(d), (0...23).contains(h), (0...59).contains(minute) else { throw NativeSyncError.invalidSnapshot }
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = timeZone
        let components = DateComponents(timeZone: timeZone, year: y, month: m, day: d, hour: h, minute: minute, second: 0)
        guard let rough = calendar.date(from: DateComponents(timeZone: timeZone, year: y, month: m, day: d)),
              let result = calendar.nextDate(after: rough.addingTimeInterval(-86400), matching: components, matchingPolicy: .strict, repeatedTimePolicy: .first),
              calendar.dateComponents([.year, .month, .day, .hour, .minute], from: result) == DateComponents(year: y, month: m, day: d, hour: h, minute: minute) else { throw NativeSyncError.invalidSnapshot }
        return result
    }
    static func tasks(_ data: Data, now: Date = Date()) throws -> [NativeSyncTask] {
        let snapshot = try object(data)
        guard let items = snapshot["items"] as? [[String: Any]], items.count <= 10000 else { throw NativeSyncError.invalidSnapshot }
        var ids = Set<String>()
        return try items.map { row in
            guard let id = row["id"] as? String, !id.isEmpty, id.count <= 200, ids.insert(id).inserted,
                  let title = row["title"] as? String, !title.isEmpty, title.count <= 300 else { throw NativeSyncError.invalidSnapshot }
            let completed = (row["completed"] as? NSNumber)?.boolValue ?? false
            let deleted = (row["deleted"] as? NSNumber)?.boolValue == true || (row["deleted_at"] != nil && !(row["deleted_at"] is NSNull))
            var task = NativeSyncTask(id: id, configured: false, active: !completed && !deleted)
            guard let raw = row["work_alerts"], !(raw is NSNull) else { return task }
            let prefs: [String: Any]
            if let string = raw as? String { guard let bytes = string.data(using: .utf8) else { throw NativeSyncError.invalidSnapshot }; prefs = try object(bytes) }
            else if let object = raw as? [String: Any] { prefs = object }
            else { throw NativeSyncError.invalidSnapshot }
            guard (prefs["version"] as? Int) == 1, Set(prefs.keys).isSubset(of: ["version", "timeZone", "alarm", "notification"]),
                  let zone = prefs["timeZone"] as? String, !zone.isEmpty, zone.count <= 100, TimeZone(identifier: zone) != nil,
                  let alarm = prefs["alarm"] as? [String: Any], let notification = prefs["notification"] as? [String: Any],
                  let alarmEnabled = boolean(alarm["enabled"]), let notificationEnabled = boolean(notification["enabled"]),
                  let alarmMode = alarm["mode"] as? String, ["work", "manual"].contains(alarmMode),
                  let notificationMode = notification["mode"] as? String, ["alarm", "manual"].contains(notificationMode),
                  Set(alarm.keys).isSubset(of: ["enabled", "mode", "at", "sound", "snoozeMinutes"]), Set(notification.keys).isSubset(of: ["enabled", "mode", "at"]),
                  let sound = alarm["sound"] as? String, ["system", "gentle", "bright"].contains(sound),
                  let snooze = alarm["snoozeMinutes"] as? Int, [0, 5, 10, 15].contains(snooze) else { throw NativeSyncError.invalidSnapshot }
            // Validate manually stored times even when disabled; never roll a DST gap forward.
            for channel in [alarm, notification] {
                if let at = channel["at"], !(at is NSNull) { guard let text = at as? String else { throw NativeSyncError.invalidSnapshot }; _ = try wallDate(text, zone: zone) }
            }
            let alarmAt = alarmMode == "manual" ? alarm["at"] as? String : row["scheduled_start"] as? String
            let normalAt = notificationMode == "manual" ? notification["at"] as? String : alarmAt
            task.configured = true
            task.alarmEnabled = alarmEnabled
            task.alarmTarget = try alarmAt.map { try wallDate($0, zone: zone) }
            func delivery(_ wall: String?, enabled: Bool) throws -> NativeSyncDelivery? {
                guard let wall else { return nil }
                let fireAt = try wallDate(wall, zone: zone)
                guard task.active, enabled, fireAt.timeIntervalSince(now) >= 5, fireAt.timeIntervalSince(now) <= 366 * 86400 else { return nil }
                return NativeSyncDelivery(taskID: id, title: title, fireAt: fireAt, timeZone: zone, sound: sound, snoozeMinutes: snooze)
            }
            task.alarm = try delivery(alarmAt, enabled: alarmEnabled)
            task.notification = try delivery(normalAt, enabled: notificationEnabled)
            return task
        }
    }
}
