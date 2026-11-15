import Foundation

struct NativeSyncResponse {
    var status: Int
    var data: Data
}
struct NativeSyncApplyResult {
    var scheduledCount: Int
    var needsAttention: Bool = false
}

@MainActor
protocol NativeSyncTransport: AnyObject {
    func send(method: String, path: String, body: [String: Any]?) async throws -> NativeSyncResponse
}

@MainActor
protocol NativeSyncProviders: AnyObject {
    func clear() async throws
    func apply(_ tasks: [NativeSyncTask], scope: String, current: @escaping () -> Bool) async throws -> NativeSyncApplyResult
}

@MainActor
protocol NativeSyncPersistence: AnyObject {
    var owner: String? { get set }
    var installationID: String { get }
    func cache(_ data: Data, owner: String) throws
    func removeSnapshot()
}

// Networking and owner changes live outside WebKit, including during an APNs wake.
// A push is only an invalidation hint: its payload never chooses an account or task.
@MainActor
final class NativeSyncEngine {
    private let transport: NativeSyncTransport
    private let providers: NativeSyncProviders
    private let persistence: NativeSyncPersistence
    private var generation = 0
    private var suspended = false
    private var inFlight: Task<Bool, Never>?
    private var registeredSignature: String?
    private var consumedSnapshot: Data?
    private(set) var scope: String?
    private(set) var lastSync: Date?
    private(set) var lastAttemptSucceeded = false
    private(set) var enabled = false
    private(set) var registered = false
    private(set) var reason = "Open DuckPlan while online to activate background sync."

    init(transport: NativeSyncTransport, providers: NativeSyncProviders, persistence: NativeSyncPersistence) {
        self.transport = transport; self.providers = providers; self.persistence = persistence
        scope = persistence.owner
    }
    var status: [String: Any] {
        ["enabled": enabled, "registered": registered, "reason": reason,
         "lastSyncAt": lastSync.map { $0.timeIntervalSince1970 * 1000 } as Any? ?? NSNull()]
    }
    private func valid(_ token: Int, _ owner: String? = nil) -> Bool {
        token == generation && !suspended && (owner == nil || owner == scope) && !Task.isCancelled
    }
    private func session(_ token: Int) async throws -> String? {
        let result = try await transport.send(method: "GET", path: "/session", body: nil)
        guard valid(token) else { throw NativeSyncError.accountChanged }
        if result.status == 401 { return nil }
        guard result.status == 200 else { throw NativeSyncError.unavailable }
        return try NativeSyncDomain.scope(result.data)
    }
    // Called before a sign-in/recovery/sign-out request can change the native cookie jar.
    func prepareAccountChange(unregister: Bool) async {
        generation &+= 1; suspended = true; inFlight?.cancel(); inFlight = nil
        let token = generation
        if unregister, scope != nil {
            _ = try? await transport.send(method: "DELETE", path: "/native-sync/devices/" + persistence.installationID, body: nil)
        }
        guard token == generation else { return }
        var cleared = scope == nil
        if scope != nil { do { try await providers.clear(); cleared = true } catch { /* Retry revocation on the next authenticated refresh. */ } }
        guard token == generation else { return }
        if cleared { scope = nil; persistence.owner = nil }
        persistence.removeSnapshot(); consumedSnapshot = nil
        registered = false; registeredSignature = nil; enabled = false; lastSync = nil
        reason = "Sign in on this device to sync its task alerts."
    }
    func resumeAfterAccountRequest() { suspended = false }
    func invalidateInFlight() { generation &+= 1; inFlight?.cancel(); inFlight = nil }
    func registrationFailed() {
        registered = false; registeredSignature = nil
        reason = "This device could not register for background sync. Open DuckPlan while online to retry."
    }
    func pushNotConfigured() {
        enabled = false; registered = false
        reason = "This build syncs while DuckPlan is open. Background sync needs a push-enabled signed build."
    }
    func synchronize() async -> Bool {
        guard !suspended else { return false }
        if let inFlight { return await inFlight.value }
        let token = generation
        let operation = Task { await self.perform(token) }
        inFlight = operation
        let result = await operation.value
        if token == generation { inFlight = nil }
        return result
    }
    private func perform(_ token: Int) async -> Bool {
        do {
            guard valid(token) else { return false }
            lastAttemptSucceeded = false
            guard let owner = try await session(token) else {
                guard valid(token) else { return false }
                let changed = scope != nil || consumedSnapshot != nil
                if scope != nil { try await providers.clear() }
                guard valid(token) else { return false }
                scope = nil; persistence.owner = nil; persistence.removeSnapshot(); consumedSnapshot = nil
                registered = false; registeredSignature = nil; lastSync = nil
                reason = "Sign in on this device to sync its task alerts."
                lastAttemptSucceeded = true
                return changed
            }
            guard valid(token) else { return false }
            if scope != owner {
                try await providers.clear()
                guard valid(token) else { return false }
                scope = owner; persistence.owner = owner; persistence.removeSnapshot()
                registered = false; registeredSignature = nil; consumedSnapshot = nil
            }
            // A hint may be coalesced while fetching. Only acknowledge the generation
            // observed before this snapshot; a newer generation remains pending.
            var snapshotGeneration: Int?
            if let capability = try? await transport.send(method: "GET", path: "/native-sync/status", body: nil), capability.status == 200,
               let config = try? NativeSyncDomain.object(capability.data), let value = config["generation"] as? Int, value >= 0 {
                snapshotGeneration = value
            }
            guard valid(token, owner) else { throw NativeSyncError.accountChanged }
            let response = try await transport.send(method: "GET", path: "/planner", body: nil)
            guard valid(token, owner), response.status == 200 else { throw NativeSyncError.accountChanged }
            let tasks = try NativeSyncDomain.tasks(response.data)
            // Session validation on both sides of the snapshot prevents late owner responses.
            let verified = try await session(token)
            guard valid(token, owner) else { throw NativeSyncError.accountChanged }
            if verified != owner {
                try await providers.clear()
                guard valid(token, owner) else { throw NativeSyncError.accountChanged }
                scope = nil; persistence.owner = nil; persistence.removeSnapshot(); consumedSnapshot = nil; registered = false; registeredSignature = nil
                throw NativeSyncError.accountChanged
            }
            let changed = consumedSnapshot != response.data
            try persistence.cache(response.data, owner: owner)
            let result = try await providers.apply(tasks, scope: owner, current: { [weak self] in self?.valid(token, owner) == true })
            guard valid(token, owner) else { return false }
            consumedSnapshot = response.data
            lastSync = Date()
            reason = result.needsAttention ? "Planner synced, but some device alerts need attention. Check permissions and device alert settings." : "Planner and device alerts synced. Background updates depend on iOS delivery."
            if let snapshotGeneration {
                _ = try? await transport.send(method: "POST", path: "/native-sync/devices/" + persistence.installationID + "/ack", body: ["generation": snapshotGeneration])
                guard valid(token, owner) else { return false }
            }
            lastAttemptSucceeded = true
            return changed
        } catch {
            if valid(token) { reason = error is NativeSyncError ? error.localizedDescription : "Background sync could not finish. Open DuckPlan while online to retry." }
            return false
        }
    }
    func register(token deviceToken: String, environment: String) async {
        guard !suspended, let owner = scope, ["sandbox", "production"].contains(environment), !deviceToken.isEmpty,
              deviceToken.count <= 400, deviceToken.allSatisfy({ $0.isHexDigit }) else { return }
        let token = generation, signature = owner + ":" + environment + ":" + deviceToken
        if registeredSignature == signature && registered { return }
        do {
            guard try await session(token) == owner, valid(token, owner) else { throw NativeSyncError.accountChanged }
            let capability = try await transport.send(method: "GET", path: "/native-sync/status", body: nil)
            guard valid(token, owner), capability.status == 200 else { throw NativeSyncError.unavailable }
            let config = try NativeSyncDomain.object(capability.data)
            enabled = NativeSyncDomain.boolean(config["enabled"]) == true
            // Store the installation even before APNs keys are activated on the server.
            let response = try await transport.send(method: "PUT", path: "/native-sync/devices/" + persistence.installationID,
                body: ["token": deviceToken, "environment": environment])
            guard valid(token, owner), response.status == 200 || response.status == 201 else { throw NativeSyncError.accountChanged }
            let result = try NativeSyncDomain.object(response.data)
            registered = NativeSyncDomain.boolean(result["registered"]) == true
            enabled = NativeSyncDomain.boolean(result["enabled"]) == true
            if registered { registeredSignature = signature }
            reason = registered && enabled ? "Background sync registered. iOS may delay updates while the app is closed." : "Background sync is awaiting server activation."
        } catch {
            if valid(token, owner) { registered = false; reason = "Background sync is awaiting activation or a connection. Foreground sync remains available." }
        }
    }
}
