import Sparkle
import TodzKit

final class UpdateReminders: NSObject, SPUStandardUserDriverDelegate {
    var supportsGentleScheduledUpdateReminders: Bool { true }

    func standardUserDriverShouldHandleShowingScheduledUpdate(_ update: SUAppcastItem, andInImmediateFocus immediateFocus: Bool) -> Bool {
        ScheduledUpdateReminder.showsNow(inImmediateFocus: immediateFocus)
    }
}
