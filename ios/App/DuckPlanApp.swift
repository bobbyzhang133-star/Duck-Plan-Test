import SwiftUI
import UIKit

@main
struct DuckPlanApp: App {
    @StateObject private var alarms = TaskAlarmStore()
    var body: some Scene {
        WindowGroup { PlannerAlarmRoot(alarms: alarms) }
    }
}

private struct PlannerAlarmRoot: View {
    @ObservedObject var alarms: TaskAlarmStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var actionError: String?
    @State private var previewDismissed = false

    private var preview: TaskAlarmRecord? {
        #if DEBUG && targetEnvironment(simulator)
        if !previewDismissed && ProcessInfo.processInfo.arguments.contains("-duckplan-alarm-preview") {
            return TaskAlarmRecord(id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!,
                scope: "preview", taskID: "preview",
                title: ProcessInfo.processInfo.environment["DUCKPLAN_ALARM_PREVIEW_TITLE"] ?? "Finish calculus practice set",
                fireAt: Date(), sound: "system",
                snoozeMinutes: ProcessInfo.processInfo.arguments.contains("-duckplan-alarm-no-snooze") ? 0 : 5)
        }
        #endif
        return nil
    }

    var body: some View {
        let alarm = alarms.ringingAlarms.first ?? preview
        ZStack {
            PlannerWebView(alarms: alarms)
                .ignoresSafeArea(edges: .bottom)
                .allowsHitTesting(alarm == nil)
                .accessibilityHidden(alarm != nil)
            if let alarm {
                DuckRingingAlarmView(alarm: alarm, error: actionError,
                    otherAlarmCount: max(0, alarms.ringingAlarms.count - 1),
                    stop: { perform(alarm, snooze: false) },
                    snooze: { perform(alarm, snooze: true) })
                    .id(alarm.id)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { alarms.refreshRingingAlarms() }
        }
        .onChange(of: alarm?.id) { _, _ in actionError = nil }
        .task { alarms.refreshRingingAlarms() }
    }

    private func perform(_ alarm: TaskAlarmRecord, snooze: Bool) {
        if preview?.id == alarm.id { previewDismissed = true; return }
        do {
            if snooze { try alarms.snoozeRinging(id: alarm.id) }
            else { try alarms.stopRinging(id: alarm.id) }
            actionError = nil
        } catch {
            actionError = "The alarm could not be updated. Try again or use the system alarm controls."
        }
    }
}

private struct AlarmBackdrop: UIViewRepresentable {
    func makeUIView(context: Context) -> UIVisualEffectView {
        UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialLight))
    }
    func updateUIView(_ view: UIVisualEffectView, context: Context) {}
}

private struct DuckRingingAlarmView: View {
    let alarm: TaskAlarmRecord
    let error: String?
    let otherAlarmCount: Int
    let stop: () -> Void
    let snooze: () -> Void
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @AccessibilityFocusState private var titleFocused: Bool
    private static let mascot: UIImage? = {
        guard let url = Bundle.main.url(forResource: "duckplan-sigma-head-v3", withExtension: "png", subdirectory: "landing/assets") else { return nil }
        return UIImage(contentsOfFile: url.path)
    }()

    var body: some View {
        ZStack {
            if reduceTransparency {
                DuckAlarmTheme.cream.ignoresSafeArea()
            } else {
                AlarmBackdrop().ignoresSafeArea()
                DuckAlarmTheme.cream.opacity(0.55).ignoresSafeArea()
            }
            GeometryReader { geometry in
                ScrollView {
                    VStack(spacing: 0) {
                        VStack(spacing: 24) {
                            if !dynamicTypeSize.isAccessibilitySize {
                                VStack(spacing: 12) {
                                    Group {
                                        if let mascot = Self.mascot {
                                            Image(uiImage: mascot).resizable().scaledToFill()
                                                .frame(width: 84, height: 84).clipShape(Circle())
                                        } else {
                                            Text("🦆").font(.system(size: 58))
                                        }
                                    }
                                    .frame(width: 108, height: 108)
                                    .background(DuckAlarmTheme.yellow.opacity(0.25), in: Circle())
                                    .clipShape(Circle())
                                    .accessibilityHidden(true)
                                    Text("DUCKPLAN")
                                        .font(.caption.weight(.bold)).tracking(3)
                                        .foregroundStyle(DuckAlarmTheme.muted)
                                }
                            }
                            VStack(spacing: 14) {
                                Label(dynamicTypeSize.isAccessibilitySize ? "Task alarm" : "Time for your task", systemImage: "alarm.fill")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(DuckAlarmTheme.muted)
                                Text(alarm.title)
                                    .font(.system(dynamicTypeSize.isAccessibilitySize ? .title2 : .largeTitle, design: .rounded, weight: .bold))
                                    .multilineTextAlignment(.center)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .accessibilityAddTraits(.isHeader)
                                    .accessibilityFocused($titleFocused)
                                if !dynamicTypeSize.isAccessibilitySize {
                                    Text("One small step. You’ve got this.")
                                        .font(.body).foregroundStyle(DuckAlarmTheme.muted)
                                        .multilineTextAlignment(.center)
                                }
                            }
                            VStack(spacing: 12) {
                                if alarm.snoozeMinutes > 0 {
                                    Button(action: snooze) {
                                        Label("Snooze · \(alarm.snoozeMinutes) min", systemImage: "zzz")
                                            .frame(maxWidth: .infinity, minHeight: 56)
                                    }
                                    .background(DuckAlarmTheme.yellow, in: RoundedRectangle(cornerRadius: 18))
                                }
                                Button(action: stop) {
                                    Label("Stop alarm", systemImage: "stop.fill")
                                        .frame(maxWidth: .infinity, minHeight: 56)
                                }
                                .background(DuckAlarmTheme.yellow, in: RoundedRectangle(cornerRadius: 18))
                                .overlay(RoundedRectangle(cornerRadius: 18)
                                    .strokeBorder(DuckAlarmTheme.ink.opacity(0.16)))
                            }
                            .font(.headline)
                            .buttonStyle(.plain)
                            if otherAlarmCount > 0 {
                                Text("\(otherAlarmCount) more ringing \(otherAlarmCount == 1 ? "task" : "tasks")")
                                    .font(.footnote).foregroundStyle(DuckAlarmTheme.muted)
                            }
                            if let error {
                                Text(error).font(.footnote).foregroundStyle(.red)
                                    .multilineTextAlignment(.center).accessibilityLabel("Alarm error: \(error)")
                            }
                        }
                        .padding(28)
                        .frame(maxWidth: 440)
                        .background(DuckAlarmTheme.cream, in: RoundedRectangle(cornerRadius: 32))
                        .overlay(RoundedRectangle(cornerRadius: 32).strokeBorder(.white.opacity(0.9)))
                        .shadow(color: DuckAlarmTheme.ink.opacity(0.12), radius: 32, y: 12)
                        .padding(20)
                    }
                    .frame(maxWidth: .infinity, minHeight: geometry.size.height)
                }
            }
        }
        .foregroundStyle(DuckAlarmTheme.ink)
        .environment(\.colorScheme, .light)
        .accessibilityAddTraits(.isModal)
        .onAppear { titleFocused = true }
    }
}
