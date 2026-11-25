import TodzKit

extension AppModel {
    func requireShortcutReadiness() async throws {
        let readiness = await shortcutReadiness()
        guard let refusal = ShortcutRefusal(readiness) else { return }
        throw refusal
    }
}
