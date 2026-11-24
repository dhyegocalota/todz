enum MenuBarCopy {
    static let openWindow = "Open todz"
    static let signedOut = "Sign in to see what's due today."
    static let naming = "Name your first workspace to see what's due today."

    static func left(count: Int) -> String {
        InflectedCopy.text("\(count) left")
    }

    static func doneToday(count: Int) -> String {
        InflectedCopy.text("\(count) done today")
    }

    static func switchHint(last: Int) -> String {
        "Switch workspace ⌘1–\(last)"
    }
}
