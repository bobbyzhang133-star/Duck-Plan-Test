import AlarmKit
import Foundation
import SwiftUI

enum DuckAlarmTheme {
    static let yellow = Color(red: 1, green: 0.85, blue: 0.24)
    static let cream = Color(red: 1, green: 0.98, blue: 0.92)
    static let ink = Color(red: 0.22, green: 0.18, blue: 0.10)
    static let muted = Color(red: 0.43, green: 0.38, blue: 0.27)
}

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
