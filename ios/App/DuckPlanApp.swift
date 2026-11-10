import SwiftUI

@main
struct DuckPlanApp: App {
    @StateObject private var alarms = TaskAlarmStore()
    var body: some Scene {
        WindowGroup { PlannerWebView(alarms: alarms).ignoresSafeArea(edges: .bottom) }
    }
}
