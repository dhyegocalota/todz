import SwiftUI

private struct AppUpdaterKey: EnvironmentKey {
    static let defaultValue: AppUpdater? = nil
}

extension EnvironmentValues {
    var appUpdater: AppUpdater? {
        get { self[AppUpdaterKey.self] }
        set { self[AppUpdaterKey.self] = newValue }
    }
}
