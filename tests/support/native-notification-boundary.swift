import Foundation
import UserNotifications

private struct BoundaryFailure: Error, CustomStringConvertible {
    let description: String
}
private func check(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() { throw BoundaryFailure(description: message) }
}
private final class MemoryPreferences: TaskNotificationPersistence {
    var values: [String: Data] = [:]
    func data(forKey key: String) -> Data? { values[key] }
    func set(_ value: Any?, forKey key: String) { values[key] = value as? Data }
}
@MainActor
private final class FakeNotificationClient: TaskNotificationClient {
    var permission: UNAuthorizationStatus = .authorized
    var requests: [String: UNNotificationRequest] = [:]
    var delivered = Set<String>()
    var adds = 0
    var failAdd = false
    var holdAuthorization = false
    var holdAdd = false
    var authorizationGate: CheckedContinuation<Bool, Error>?
    var addGate: CheckedContinuation<Void, Error>?
    func authorization() async -> UNAuthorizationStatus { permission }
    func authorize() async throws -> Bool {
        if holdAuthorization {
            let result = try await withCheckedThrowingContinuation { authorizationGate = $0 }
            permission = result ? .authorized : .denied
            return result
        }
        return permission == .authorized
    }
    func pending() async -> [UNNotificationRequest] { Array(requests.values) }
    func deliveredIDs() async -> [String] { Array(delivered) }
    func add(_ request: UNNotificationRequest) async throws {
        adds += 1
        if holdAdd { try await withCheckedThrowingContinuation { addGate = $0 } }
        if failAdd { throw BoundaryFailure(description: "Fixture add failure") }
        requests[request.identifier] = request
    }
    func removePending(_ ids: [String]) { ids.forEach { requests.removeValue(forKey: $0) } }
    func removeDelivered(_ ids: [String]) { ids.forEach { delivered.remove($0) } }
}

@main
private struct NativeNotificationBoundary {
    @MainActor
    static func rejection(_ operation: () async throws -> Void) async throws {
        do { try await operation() }
        catch { return }
        throw BoundaryFailure(description: "Expected operation to reject")
    }

    @MainActor
    static func main() async throws {
        let client = FakeNotificationClient(), preferences = MemoryPreferences()
        let store = TaskNotificationStore(client: client, defaults: preferences)
        let future = Date().addingTimeInterval(600)
        try await store.context(scope: "A", activeTaskIDs: ["essay", "second"])
        let first = try await store.save(taskID: "essay", title: "Write essay", fireAt: future, expectedScope: "A")
        try check(client.requests.count == 1 && first.id.hasPrefix(TaskNotificationStore.identifierPrefix), "Scoped native request not saved")
        try check(first.bridgeValue["item_id"] as? String == "essay", "Bridge did not return task ID")
        try check(first.bridgeValue["fire_at"] as? Double == future.timeIntervalSince1970 * 1000, "Bridge epoch changed")
        let request = client.requests[first.id]!
        try check(request.content.title == "Write essay" && request.content.sound != nil, "Banner title/default sound missing")
        try check((request.trigger as? UNCalendarNotificationTrigger)?.repeats == false, "Notification accidentally repeats")
        let options = store.presentationOptions(for: request)
        try check(options.contains(.banner) && options.contains(.sound), "Foreground notification suppressed banner or sound")
        let forged = UNNotificationRequest(identifier: "other.feature", content: request.content, trigger: request.trigger)
        try check(store.presentationOptions(for: forged).isEmpty, "Unrelated request inherited task presentation")
        let replacementDate = future.addingTimeInterval(60)
        let replaced = try await store.save(taskID: "essay", title: "Updated essay", fireAt: replacementDate, expectedScope: "A")
        try check(replaced.id == first.id && client.requests.count == 1, "Replacement changed identity or duplicated notification")
        client.failAdd = true
        try await rejection { _ = try await store.save(taskID: "essay", title: "Rejected title", fireAt: future.addingTimeInterval(120)) }
        client.failAdd = false
        let retained = try await store.list()
        try check(retained.first?.title == "Updated essay" && abs((retained.first?.fireAt.timeIntervalSince1970 ?? 0) - replacementDate.timeIntervalSince1970) < 0.001, "Failed replacement lost prior request")
        print("PASS stable scoped schedule, exact bridge metadata and failed replacement preservation")

        let restored = TaskNotificationStore(client: client, defaults: preferences)
        try await restored.context(scope: "A", activeTaskIDs: ["essay", "second"])
        let reloaded = try await restored.list()
        try check(reloaded.count == 1 && reloaded[0].title == "Updated essay", "Relaunch lost pending notification")
        let emptyPreferences = MemoryPreferences()
        let recovered = TaskNotificationStore(client: client, defaults: emptyPreferences)
        try await recovered.context(scope: "A", activeTaskIDs: ["essay"])
        let recoveredList = try await recovered.list()
        try check(recoveredList.count == 1, "OS request could not recover after metadata interruption")
        print("PASS in-memory persistence/relaunch and pending-request recovery without device writes")

        client.delivered.insert(first.id)
        try await store.context(scope: "A", activeTaskIDs: ["second"])
        try check(client.requests.isEmpty && client.delivered.isEmpty, "Completion/deletion context left a notification")
        _ = try await store.save(taskID: "second", title: "Second", fireAt: future)
        let otherID = TaskNotificationStore.identifier(scope: "B", taskID: "second")
        try check(otherID != TaskNotificationStore.identifier(scope: "A", taskID: "second"), "Two owners share a notification identifier")
        try await store.context(scope: "B", activeTaskIDs: ["second"])
        try check(client.requests.isEmpty, "Sign-out/owner switch retained prior owner's pending request")
        try check(store.presentationOptions(for: request).isEmpty, "Old owner's notification can present in new account")
        let b = try await store.save(taskID: "second", title: "B second", fireAt: future, expectedScope: "B")
        client.delivered.insert(b.id)
        try store.cancel(taskID: "second", expectedScope: "B")
        try check(client.requests.isEmpty && client.delivered.isEmpty, "Cancel did not remove pending/delivered request")
        print("PASS inactive-task cancellation, owner isolation and independent cancel")

        let raceClient = FakeNotificationClient(), raceStore = TaskNotificationStore(client: raceClient, defaults: MemoryPreferences())
        raceClient.permission = .notDetermined; raceClient.holdAuthorization = true
        try await raceStore.context(scope: "A", activeTaskIDs: ["essay"])
        let authorizing = Task { @MainActor in try await raceStore.save(taskID: "essay", title: "A only", fireAt: future, expectedScope: "A") }
        while raceClient.authorizationGate == nil { await Task.yield() }
        try await raceStore.context(scope: "B", activeTaskIDs: ["essay"])
        raceClient.authorizationGate?.resume(returning: true); raceClient.authorizationGate = nil
        try await rejection { _ = try await authorizing.value }
        try check(raceClient.adds == 0 && raceClient.requests.isEmpty, "Permission await scheduled an old owner's task")
        print("PASS permission-await context race rejects before native add")

        raceClient.holdAuthorization = false; raceClient.holdAdd = true
        let adding = Task { @MainActor in try await raceStore.save(taskID: "essay", title: "B only", fireAt: future, expectedScope: "B") }
        while raceClient.addGate == nil { await Task.yield() }
        try await raceStore.context(scope: "A", activeTaskIDs: ["essay"])
        raceClient.addGate?.resume(); raceClient.addGate = nil
        try await rejection { _ = try await adding.value }
        try check(raceClient.requests.isEmpty && raceStore.records.isEmpty, "Late add survived owner change")
        print("PASS add-await context race retires late pending request")

        raceClient.holdAdd = false; raceClient.permission = .notDetermined; raceClient.holdAuthorization = true
        let deleting = Task { @MainActor in try await raceStore.save(taskID: "essay", title: "Deleted while authorizing", fireAt: future, expectedScope: "A") }
        while raceClient.authorizationGate == nil { await Task.yield() }
        try await raceStore.context(scope: "A", activeTaskIDs: [])
        let addsBeforeDeletion = raceClient.adds
        raceClient.authorizationGate?.resume(returning: true); raceClient.authorizationGate = nil
        try await rejection { _ = try await deleting.value }
        try check(raceClient.adds == addsBeforeDeletion && raceClient.requests.isEmpty, "Deleted/completed task survived authorization await")
        print("PASS same-owner deletion during authorization cannot schedule an inactive task")

        let tapStore = TaskNotificationStore(client: FakeNotificationClient(), defaults: MemoryPreferences())
        var opens = 0; tapStore.onOpen = { if tapStore.currentOpenTarget() != nil { opens += 1 } }
        tapStore.queueOpen(scope: "A", taskID: "essay")
        try check(tapStore.currentOpenTarget() == nil && opens == 0, "Cold-launch tap routed before account context")
        try await tapStore.context(scope: "A", activeTaskIDs: ["essay"])
        try check(tapStore.currentOpenTarget()?.taskID == "essay" && opens == 1, "Cold-launch tap did not route matching task")
        tapStore.finishOpen(scope: "A", taskID: "essay")
        tapStore.queueOpen(scope: "B", taskID: "essay")
        try check(tapStore.currentOpenTarget() == nil && opens == 1, "Other owner's tap reached current planner")
        tapStore.queueOpen(scope: "A", taskID: "missing")
        try check(tapStore.currentOpenTarget() == nil, "Deleted task tap reached planner")
        print("PASS queued notification tap routing waits for matching owner and active task")

        let denyClient = FakeNotificationClient(), denyStore = TaskNotificationStore(client: denyClient, defaults: MemoryPreferences())
        denyClient.permission = .denied
        try await denyStore.context(scope: "A", activeTaskIDs: ["essay"])
        try await rejection { _ = try await denyStore.save(taskID: "essay", title: "Essay", fireAt: future) }
        try await rejection { _ = try await denyStore.save(taskID: "essay", title: "Essay", fireAt: future, expectedScope: "B") }
        try await rejection { _ = try await denyStore.save(taskID: "essay", title: "Essay", fireAt: Date()) }
        try await rejection { _ = try await denyStore.save(taskID: "essay", title: "Essay", fireAt: Date().addingTimeInterval(367 * 86400)) }
        try check(denyClient.adds == 0, "Denied/invalid save touched native requests")
        print("PASS permission denial, scope mismatch and invalid time rejection")

        let allClient = FakeNotificationClient(), allStore = TaskNotificationStore(client: allClient, defaults: MemoryPreferences())
        try await allStore.context(scope: "A", activeTaskIDs: ["essay"])
        let all = try await allStore.save(taskID: "essay", title: "Essay", fireAt: future)
        allClient.delivered.insert(all.id)
        let unrelated = UNNotificationRequest(identifier: "unrelated.feature", content: UNMutableNotificationContent(), trigger: nil)
        allClient.requests[unrelated.identifier] = unrelated; allClient.delivered.insert(unrelated.identifier)
        try await rejection { try await allStore.cancelAll(expectedScope: "B") }
        try check(allClient.requests[all.id] != nil, "Wrong-owner cancel changed requests")
        try await allStore.cancelAll(expectedScope: "A")
        try check(allClient.requests.count == 1 && allClient.requests[unrelated.identifier] != nil && allClient.delivered == [unrelated.identifier], "Channel cancellation affected unrelated feature")
        print("PASS cancel-all is scoped to this notification channel")
        var currentGeneration = 0, lateRequest = false
        var retired = 0
        for fails in [false, true] {
            currentGeneration = 0; lateRequest = false
            var restoreGate: CheckedContinuation<Void, Error>?
            let restoring = Task { @MainActor in
                try await NativeScopeGuard.restore(current: { currentGeneration == 0 }, operation: {
                    lateRequest = true
                    try await withCheckedThrowingContinuation { restoreGate = $0 }
                }, retire: { lateRequest = false; retired += 1 },
                   staleError: BoundaryFailure(description: "stale-restoration"))
            }
            for _ in 0..<10000 {
                if restoreGate != nil { break }
                await Task.yield()
            }
            try check(restoreGate != nil, "Restoration did not enter its suspension")
            currentGeneration = 1
            if fails { restoreGate?.resume(throwing: BoundaryFailure(description: "restore-failed")) }
            else { restoreGate?.resume() }
            do { try await restoring.value; throw BoundaryFailure(description: "Late restoration unexpectedly succeeded") }
            catch { try check(String(describing: error) == "stale-restoration", "Old context returned the wrong restoration error") }
            try check(!lateRequest, "Restored prior-owner alarm survived a scope change")
            print("PASS late restoration \(fails ? "failure" : "success") retires old-owner system request")
        }
        try check(retired == 2, "Late restorations were not retired exactly once")
        var sameOwnerRetired = false
        do {
            try await NativeScopeGuard.restore(current: { true }, operation: {
                throw BoundaryFailure(description: "same-owner-restore-failed")
            }, retire: { sameOwnerRetired = true }, staleError: BoundaryFailure(description: "stale-restoration"))
            throw BoundaryFailure(description: "Failed restoration unexpectedly succeeded")
        } catch { try check(String(describing: error) == "same-owner-restore-failed" && !sameOwnerRetired, "Current owner's restore error changed") }
        print("PASS same-owner restoration failure preserves its original error")
        print("12 native notification and scope-restoration boundary cases passed")
    }
}
