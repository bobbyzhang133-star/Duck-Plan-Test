import AlarmKit
import Foundation

struct TaskAlarmMetadata: AlarmMetadata {
    var taskID: String
    var title: String
}

struct TaskAlarmRecord: Codable, Identifiable, Sendable {
    var id: UUID
    var scope: String
    var taskID: String
    var title: String
    var fireAt: Date
    var sound: String
    var snoozeMinutes: Int

    var bridgeValue: [String: Any] {
        ["id": id.uuidString, "item_id": taskID, "title": title,
         "fire_at": fireAt.timeIntervalSince1970 * 1000,
         "sound": sound, "snoozeMinutes": snoozeMinutes]
    }
}
