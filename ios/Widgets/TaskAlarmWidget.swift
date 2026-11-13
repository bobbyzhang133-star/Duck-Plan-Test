import ActivityKit
import AlarmKit
import SwiftUI
import WidgetKit

@main
struct TaskAlarmWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<TaskAlarmMetadata>.self) { context in
            VStack(alignment: .center, spacing: 10) {
                HStack(spacing: 8) {
                    Text("🦆").accessibilityHidden(true)
                    Text(status(context.state)).font(.caption.weight(.semibold))
                }
                .foregroundStyle(DuckAlarmTheme.muted)
                Text(context.attributes.metadata?.title ?? "Task alarm")
                    .font(.system(.headline, design: .rounded)).multilineTextAlignment(.center)
                    .lineLimit(3)
                countdown(context.state)
                    .font(.title2.weight(.bold)).foregroundStyle(DuckAlarmTheme.ink)
            }
            .frame(maxWidth: .infinity)
            .padding(18)
            .foregroundStyle(DuckAlarmTheme.ink)
            .activityBackgroundTint(DuckAlarmTheme.cream)
            .activitySystemActionForegroundColor(DuckAlarmTheme.ink)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Text("🦆") }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.metadata?.title ?? "DuckPlan")
                        .font(.headline).foregroundStyle(DuckAlarmTheme.yellow).lineLimit(2)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    countdown(context.state).foregroundStyle(DuckAlarmTheme.yellow)
                }
            } compactLeading: { Image(systemName: "alarm.fill").foregroundStyle(DuckAlarmTheme.yellow) }
              compactTrailing: { countdown(context.state).foregroundStyle(DuckAlarmTheme.yellow).frame(maxWidth: 64) }
              minimal: { Image(systemName: "alarm.fill").foregroundStyle(DuckAlarmTheme.yellow) }
              .keylineTint(DuckAlarmTheme.yellow)
        }
    }

    private func status(_ state: AlarmPresentationState) -> String {
        switch state.mode {
        case .countdown: "DuckPlan · Snoozed"
        case .paused: "DuckPlan · Paused"
        default: "DuckPlan · Task alarm"
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
