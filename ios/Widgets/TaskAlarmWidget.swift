import ActivityKit
import AlarmKit
import SwiftUI
import WidgetKit

@main
struct TaskAlarmWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<TaskAlarmMetadata>.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                Label("DuckPlan · Snoozed", systemImage: "zzz")
                Text(context.attributes.metadata?.title ?? "Task alarm").font(.headline)
                countdown(context.state)
            }
            .padding()
            .activityBackgroundTint(.orange.opacity(0.15))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Image(systemName: "alarm.fill") }
                DynamicIslandExpandedRegion(.center) { Text(context.attributes.metadata?.title ?? "DuckPlan") }
                DynamicIslandExpandedRegion(.bottom) { countdown(context.state) }
            } compactLeading: { Image(systemName: "alarm.fill") }
              compactTrailing: { Text("zzz") }
              minimal: { Image(systemName: "alarm.fill") }
        }
    }

    @ViewBuilder private func countdown(_ state: AlarmPresentationState) -> some View {
        switch state.mode {
        case .countdown(let countdown):
            Text(timerInterval: Date.now...max(Date.now, countdown.fireDate), countsDown: true).monospacedDigit()
        case .paused: Text("Alarm paused")
        default: Text("Task alarm")
        }
    }
}
