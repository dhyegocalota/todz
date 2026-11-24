import Testing
@testable import TodzKit

@Suite struct WidgetNotificationTests {
    @Test func theRequestsNotificationKeepsTheNameBothProcessesUse() {
        #expect(WidgetNotification.requestsAdded == "dev.todz.widgets.requests")
    }
}
