import Foundation

enum BoundaryFailure: Error { case assertion(String) }
func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws { if !condition() { throw BoundaryFailure.assertion(message) } }
func data(_ object: [String: Any]) -> Data { try! JSONSerialization.data(withJSONObject: object) }
func prefs(_ alarmAt: Any = NSNull(), alarmMode: String = "work", normalAt: Any = NSNull(), normalMode: String = "alarm", zone: String = "UTC") -> [String: Any] {
    ["version": 1, "timeZone": zone, "alarm": ["enabled": true, "mode": alarmMode, "at": alarmAt, "sound": "bright", "snoozeMinutes": 10],
     "notification": ["enabled": true, "mode": normalMode, "at": normalAt]]
}
func row(_ settings: Any = NSNull(), id: String = "essay", start: String = "2030-05-02T14:00", completed: Int = 0) -> [String: Any] {
    ["id": id, "title": "Write essay", "completed": completed, "scheduled_start": start, "work_alerts": settings, "notes": "Keep all task details"]
}
func wall(_ date: Date) -> String {
    let format = DateFormatter(); format.calendar = Calendar(identifier: .gregorian); format.locale = Locale(identifier: "en_US_POSIX"); format.timeZone = TimeZone(secondsFromGMT: 0)
    format.dateFormat = "yyyy-MM-dd'T'HH:mm"; return format.string(from: date)
}

@MainActor final class MemoryState: NativeSyncPersistence {
    var owner: String? = "owner-a"
    let installationID = "00000000-0000-4000-8000-000000000001"
    var snapshots: [(String, Data)] = []
    var removed = 0
    func cache(_ data: Data, owner: String) throws { snapshots.append((owner, data)) }
    func removeSnapshot() { removed += 1 }
}
@MainActor final class Providers: NativeSyncProviders {
    var clears = 0, applications = 0
    var owners: [String] = []
    func clear() async throws { clears += 1 }
    var needsAttention = false
    func apply(_ tasks: [NativeSyncTask], scope: String, current: @escaping () -> Bool) async throws -> NativeSyncApplyResult {
        guard current() else { throw NativeSyncError.accountChanged }
        applications += 1; owners.append(scope)
        return NativeSyncApplyResult(scheduledCount: tasks.filter { $0.alarm != nil }.count, needsAttention: needsAttention)
    }
}
@MainActor final class Transport: NativeSyncTransport {
    var owner: String? = "owner-a", generation = 8, enabled = true
    var calls: [(String, String, [String: Any]?)] = []
    var sessionCalls = 0
    var snapshot = data(["items": [row(prefs(), start: wall(Date().addingTimeInterval(86400)))], "classes": [["id": "calculus"]]])
    var holdPlanner = false
    var pending: CheckedContinuation<NativeSyncResponse, Never>?
    var ownerAfterSnapshot: String?
    var bumpGenerationAfterSnapshot = false
    func send(method: String, path: String, body: [String: Any]?) async throws -> NativeSyncResponse {
        calls.append((method, path, body))
        if path == "/session" {
            sessionCalls += 1
            if sessionCalls == 2, let changed = ownerAfterSnapshot { owner = changed }
            return .init(status: 200, data: data(["user": owner.map { ["id": $0] } as Any? ?? NSNull()]))
        }
        if path == "/native-sync/status" { return .init(status: 200, data: data(["enabled": enabled, "generation": generation, "environments": ["sandbox", "production"]])) }
        if path == "/planner" {
            if bumpGenerationAfterSnapshot { generation += 1 }
            if holdPlanner { return await withCheckedContinuation { pending = $0 } }
            return .init(status: 200, data: snapshot)
        }
        if method == "PUT" { return .init(status: 200, data: data(["registered": true, "enabled": enabled])) }
        if method == "POST" { return .init(status: 200, data: data(["acknowledged": true])) }
        return .init(status: 204, data: Data())
    }
}

@main struct NativeSyncBoundary {
    @MainActor static func main() async throws {
        var passed = 0
        let now = try NativeSyncDomain.wallDate("2030-05-01T12:00", zone: "UTC")
        let linked = try NativeSyncDomain.tasks(data(["items": [row(prefs())]]), now: now)[0]
        try expect(linked.alarm?.fireAt == linked.notification?.fireAt, "linked defaults diverged")
        try expect(linked.alarm?.sound == "bright" && linked.alarm?.snoozeMinutes == 10, "sound/snooze lost"); passed += 1
        let manual = try NativeSyncDomain.tasks(data(["items": [row(prefs("2030-05-02T13:00", alarmMode: "manual", normalAt: "2030-05-02T12:30", normalMode: "manual"))]]), now: now)[0]
        try expect(manual.alarm?.fireAt != manual.notification?.fireAt, "manual override relinked"); passed += 1
        var off = prefs(); var alarm = off["alarm"] as! [String: Any]; alarm["enabled"] = false; off["alarm"] = alarm
        let disabled = try NativeSyncDomain.tasks(data(["items": [row(off)]]), now: now)[0]
        try expect(disabled.alarm == nil && disabled.notification != nil, "independent switch was ignored"); passed += 1
        let old = try NativeSyncDomain.tasks(data(["items": [row()]]), now: now)[0]
        try expect(!old.configured && old.alarm == nil, "unconfigured legacy task activated"); passed += 1
        let done = try NativeSyncDomain.tasks(data(["items": [row(prefs(), completed: 1)]]), now: now)[0]
        try expect(!done.active && done.alarm == nil && done.notification == nil, "completed task activated"); passed += 1
        let past = try NativeSyncDomain.tasks(data(["items": [row(prefs(), start: "2030-04-30T12:00")]]), now: now)[0]
        try expect(past.alarm == nil && past.notification == nil, "past alert activated"); passed += 1
        try expect(NativeSyncDomain.preserveRinging(past, fireAt: past.alarmTarget, alerting: true, deviceEnabled: true), "unchanged past alarm would be stopped while ringing")
        try expect(!NativeSyncDomain.preserveRinging(past, fireAt: past.alarmTarget?.addingTimeInterval(60), alerting: true, deviceEnabled: true), "actual time edit preserved old ringing alarm")
        try expect(!NativeSyncDomain.preserveRinging(past, fireAt: past.alarmTarget, alerting: false, deviceEnabled: true), "non-alerting past alarm preserved")
        try expect(!NativeSyncDomain.preserveRinging(past, fireAt: past.alarmTarget, alerting: true, deviceEnabled: false), "device pause did not cancel ringing alarm")
        var switchedOff = past; switchedOff.alarmEnabled = false
        try expect(!NativeSyncDomain.preserveRinging(switchedOff, fireAt: past.alarmTarget, alerting: true, deviceEnabled: true), "explicit off did not cancel ringing alarm")
        var completedPast = past; completedPast.active = false
        try expect(!NativeSyncDomain.preserveRinging(completedPast, fireAt: past.alarmTarget, alerting: true, deviceEnabled: true), "completed/deleted ringing alarm preserved"); passed += 1
        let ambiguous = try NativeSyncDomain.wallDate("2026-11-01T01:30", zone: "America/Los_Angeles")
        try expect(ambiguous.timeIntervalSince1970 == 1793521800, "ambiguous time did not choose first occurrence"); passed += 1
        do { _ = try NativeSyncDomain.wallDate("2027-03-14T02:30", zone: "America/Los_Angeles"); throw BoundaryFailure.assertion("DST gap accepted") } catch NativeSyncError.invalidSnapshot { passed += 1 }
        do { _ = try NativeSyncDomain.tasks(data(["items": [row(prefs()), row(prefs())]]), now: now); throw BoundaryFailure.assertion("duplicate ID accepted") } catch NativeSyncError.invalidSnapshot { passed += 1 }
        do { _ = try NativeSyncDomain.wallDate("2030-02-30T12:00", zone: "UTC"); throw BoundaryFailure.assertion("invalid date rolled forward") } catch NativeSyncError.invalidSnapshot { passed += 1 }

        do {
            let transport = Transport(), state = MemoryState(), providers = Providers()
            transport.bumpGenerationAfterSnapshot = true
            let engine = NativeSyncEngine(transport: transport, providers: providers, persistence: state)
            let result = await engine.synchronize()
            try expect(result && providers.applications == 1, "authenticated snapshot not applied")
            try expect(state.snapshots.count == 1, "full planner not cached")
            let cached = try NativeSyncDomain.object(state.snapshots[0].1)
            try expect(cached["classes"] != nil, "full planner details lost")
            let ack = transport.calls.first { $0.1.hasSuffix("/ack") }
            try expect(ack?.2?["generation"] as? Int == 8, "ack consumed a newer un-fetched generation")
            let statusIndex = transport.calls.firstIndex { $0.1 == "/native-sync/status" }!, plannerIndex = transport.calls.firstIndex { $0.1 == "/planner" }!
            try expect(statusIndex < plannerIndex, "generation read after snapshot"); passed += 1
        }
        do {
            let transport = Transport(), state = MemoryState(), providers = Providers()
            transport.ownerAfterSnapshot = "owner-b"
            let engine = NativeSyncEngine(transport: transport, providers: providers, persistence: state)
            let result = await engine.synchronize()
            try expect(!result && providers.applications == 0 && state.snapshots.isEmpty, "mismatched owner snapshot applied")
            try expect(!transport.calls.contains { $0.1.hasSuffix("/ack") }, "stale owner acknowledged"); passed += 1
        }
        do {
            let transport = Transport(), state = MemoryState(), providers = Providers()
            transport.holdPlanner = true
            let engine = NativeSyncEngine(transport: transport, providers: providers, persistence: state)
            let request = Task { await engine.synchronize() }
            while transport.pending == nil { await Task.yield() }
            await engine.prepareAccountChange(unregister: true)
            transport.pending?.resume(returning: .init(status: 200, data: transport.snapshot))
            let result = await request.value
            try expect(!result && providers.applications == 0 && state.snapshots.isEmpty, "late planner survived sign-out")
            try expect(transport.calls.contains { $0.0 == "DELETE" && $0.1.contains("/native-sync/devices/") }, "device not unregistered before cookie logout")
            try expect(!transport.calls.contains { $0.1.hasSuffix("/ack") }, "late snapshot acknowledged"); passed += 1
        }
        do {
            let transport = Transport(), state = MemoryState(), providers = Providers(); state.owner = nil; transport.owner = nil
            let engine = NativeSyncEngine(transport: transport, providers: providers, persistence: state)
            _ = await engine.synchronize()
            try expect(providers.clears == 0, "anonymous refresh canceled unrelated local-mode alarms"); passed += 1
        }
        do {
            let transport = Transport(), state = MemoryState(), providers = Providers(); transport.owner = nil
            let engine = NativeSyncEngine(transport: transport, providers: providers, persistence: state)
            _ = await engine.synchronize()
            try expect(providers.clears == 1 && state.owner == nil, "revoked session retained previous account alarms"); passed += 1
        }
        do {
            let transport = Transport(), state = MemoryState(), providers = Providers(); transport.enabled = false
            let engine = NativeSyncEngine(transport: transport, providers: providers, persistence: state)
            await engine.register(token: "abcd1234", environment: "sandbox")
            try expect(engine.registered && !engine.enabled, "inactive backend was reported active or device was not stored")
            try expect(transport.calls.contains { $0.0 == "PUT" }, "inactive server registration skipped")
            let status = String(data: data(engine.status), encoding: .utf8)!
            try expect(!status.contains("abcd1234"), "APNs token exposed in status"); passed += 1
        }
        do {
            var observation = NativeSyncSessionObservation()
            try expect(observation.observe("owner-a"), "first authenticated session did not refresh")
            try expect(!observation.observe("owner-a") && !observation.observe("owner-a"), "same session started repeated native refreshes")
            try expect(observation.observe(nil) && !observation.observe(nil), "revocation was lost or repeatedly refreshed")
            try expect(observation.observe("owner-b"), "new account did not refresh")
            observation.reset()
            try expect(observation.observe("owner-b"), "auth mutation did not revalidate session"); passed += 1
        }
        do {
            let transport = Transport(), state = MemoryState(), providers = Providers()
            let engine = NativeSyncEngine(transport: transport, providers: providers, persistence: state)
            let first = await engine.synchronize(), second = await engine.synchronize()
            try expect(first && !second && engine.lastAttemptSucceeded, "unchanged snapshot emitted another update")
            try expect(providers.applications == 2 && transport.calls.filter { $0.1.hasSuffix("/ack") }.count == 2, "unchanged snapshot skipped reconciliation/ack")
            transport.owner = "owner-b"
            let changedOwner = await engine.synchronize()
            try expect(changedOwner && providers.owners.last == "owner-b", "owner change did not emit update"); passed += 1
        }
        do {
            let transport = Transport(), state = MemoryState(), providers = Providers(); providers.needsAttention = true
            let engine = NativeSyncEngine(transport: transport, providers: providers, persistence: state)
            let result = await engine.synchronize()
            try expect(result && transport.calls.contains { $0.1.hasSuffix("/ack") }, "delivery failure prevented snapshot acknowledgement")
            try expect(engine.reason.contains("need attention"), "OS delivery failure was hidden"); passed += 1
        }
        do {
            let transport = Transport(), state = MemoryState(), providers = Providers()
            transport.snapshot = data(["items": [row(prefs(), id: "x"), row(prefs(), id: "x")]])
            let engine = NativeSyncEngine(transport: transport, providers: providers, persistence: state)
            _ = await engine.synchronize()
            try expect(providers.applications == 0 && state.snapshots.isEmpty, "invalid snapshot mutated device state")
            try expect(!transport.calls.contains { $0.1.hasSuffix("/ack") }, "invalid snapshot acknowledged"); passed += 1
        }
        print("Native sync boundaries: \(passed) PASS")
    }
}
