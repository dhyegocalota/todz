import TodzKit

extension AppModel {
    var keyActionDisabledReason: String? {
        guard case .offline = syncStatus else { return nil }
        return KeyScreenCopy.offlineReason
    }

    var keyProject: Project? {
        activeWorkspace?.projects.first { $0.identifier == keyProjectIdentifier }
    }
}
