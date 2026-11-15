import Foundation

// A failed replacement may restore its previous system request across an actor suspension.
// Retire a late restoration before returning any error to the caller.
@MainActor
enum NativeScopeGuard {
    static func restore(current: () -> Bool, operation: () async throws -> Void,
                        retire: () -> Void, staleError: Error) async throws {
        guard current() else { retire(); throw staleError }
        do { try await operation() }
        catch {
            guard current() else { retire(); throw staleError }
            throw error
        }
        guard current() else { retire(); throw staleError }
    }
}
