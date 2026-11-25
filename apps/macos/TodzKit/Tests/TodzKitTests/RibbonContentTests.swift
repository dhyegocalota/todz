import Foundation
import Testing
@testable import TodzKit

private let inbox = Project(identifier: "acme-inbox", name: "Inbox", isInbox: true, createdAt: fixedInstant)

private func openTask(_ number: Int, title: String) -> BoardTask {
    BoardTask(project: inbox, task: MutableTask(number: number, title: title).record)
}

@Suite struct RibbonContentTests {
    @Test func anUnknownTodayIsNoRibbon() {
        #expect(RibbonContent.of(open: nil) == nil)
    }

    @Test func anEmptyTodayIsNoRibbon() {
        #expect(RibbonContent.of(open: []) == nil)
    }

    @Test func severalOpenTasksCountThemAndNameTheFirst() {
        let open = [openTask(12, title: "Review PR"), openTask(3, title: "Write notes"), openTask(7, title: "Ship it")]
        #expect(RibbonContent.of(open: open) == .remaining(left: 3, next: RibbonTask(number: 12, title: "Review PR")))
    }

    @Test func oneOpenTaskIsTheLastOne() {
        #expect(RibbonContent.of(open: [openTask(12, title: "Review PR")]) == .last(RibbonTask(number: 12, title: "Review PR")))
    }

    @Test func theFirstTaskIsTheFirstListedNotTheLowestNumber() {
        let open = [openTask(40, title: "Listed first"), openTask(2, title: "Lowest number")]
        #expect(RibbonContent.of(open: open) == .remaining(left: 2, next: RibbonTask(number: 40, title: "Listed first")))
    }
}
