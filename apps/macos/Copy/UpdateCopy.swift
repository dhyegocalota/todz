enum UpdateCopy {
    static let checkForUpdates = "Check for Updates…"
    static let automaticUpdates = "Update todz automatically"
    static let automaticUpdatesDetail = "Downloads new versions in the background and installs them when you quit or reopen todz."
    static func updatedTo(version: String) -> String {
        "Updated to \(version)"
    }
}
