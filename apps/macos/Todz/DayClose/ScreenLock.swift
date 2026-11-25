import CoreGraphics

private let screenIsLockedKey = "CGSSessionScreenIsLocked"

enum ScreenLock {
    static var isLocked: Bool {
        guard let session = CGSessionCopyCurrentDictionary() as? [String: Any] else { return true }
        return session[screenIsLockedKey] as? Bool == true
    }
}
