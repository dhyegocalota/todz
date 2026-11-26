import Testing
@testable import TodzKit

@Suite struct ScheduledUpdateReminderTests {
    @Test func aScheduledUpdateShowsWhenTheAppIsInImmediateFocus() {
        #expect(ScheduledUpdateReminder.showsNow(inImmediateFocus: true))
    }

    @Test func aScheduledUpdateWaitsWhenTheAppIsNotInImmediateFocus() {
        #expect(!ScheduledUpdateReminder.showsNow(inImmediateFocus: false))
    }
}
