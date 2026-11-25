import AppIntents
import TodzKit

private func isFocusFilterQuiet() async -> Bool {
    do {
        return try await TodzFocusFilter.current.isQuiet
    } catch {
        return false
    }
}

extension AppDelegate {
    func makeFocusSwitch() -> FocusSwitchCoordinator {
        FocusSwitchCoordinator(
            gate: gate,
            preference: respectFocusPreference,
            readFilter: { await isFocusFilterQuiet() },
            pause: { try await Task.sleep(for: $0) }
        )
    }
}
