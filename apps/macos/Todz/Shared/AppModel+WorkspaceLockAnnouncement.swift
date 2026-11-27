import SwiftUI
import TodzKit

extension AppModel {
    func announceConfirmationFailure() {
        guard workspaceLock.isConfirmationFailed else { return }
        AccessibilityNotification.Announcement(WorkspaceLockCopy.confirmationFailed).post()
    }
}
