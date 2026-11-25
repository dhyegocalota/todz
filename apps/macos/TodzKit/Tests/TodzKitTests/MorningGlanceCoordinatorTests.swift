import Foundation
import Observation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 25)
private let tomorrow = today.adding(days: 1)
private let minutesPerHour = 60
private let tokyoTimeZoneIdentifier = "Asia/Tokyo"
private let otherWorkspaceIdentifier = "side"
private let openTaskCount = 3
private let secondsOfTheCountWait: TimeInterval = 60

private func glanceContent(openCount: Int, workspaceIdentifier: String = "acme") -> MorningGlanceContent {
    let rows = (0..<min(openCount, MorningGlanceContent.rowLimit)).map {
        WidgetSnapshotTask(
            projectIdentifier: "\(workspaceIdentifier)-inbox",
            projectName: "Inbox",
            number: $0 + 1,
            title: "Task \($0 + 1)",
            dueDate: nil,
            creatorLabel: nil,
            isOverdue: false,
            state: .open
        )
    }
    return MorningGlanceContent(workspaceIdentifier: workspaceIdentifier, openCount: openCount, rows: rows, restCount: openCount - rows.count)
}

@MainActor @Observable private final class FakeGlanceContent {
    var content: MorningGlanceContent?

    init(content: MorningGlanceContent?) {
        self.content = content
    }
}

@MainActor private final class FakeScreen {
    var isLocked = false
    var isMirrored = false
}

@MainActor private final class FakeFront {
    var isInFront = false
}

@MainActor private final class FakeGlancePanel {
    private(set) var shown: [MorningGlanceContent] = []
    private(set) var closings = 0
    var answers = true
    var whileShowing: (() async -> Void)?

    var attempts: Int {
        shown.count
    }

    func show(_ content: MorningGlanceContent) async -> Bool {
        shown.append(content)
        await whileShowing?()
        return answers
    }

    func close() {
        closings += 1
    }
}

@MainActor private struct GlanceHarness {
    let gate = ProactiveGate()
    let clock = HarnessClock()
    let fakeContent: FakeGlanceContent
    let screen = FakeScreen()
    let front = FakeFront()
    let panel = FakeGlancePanel()
    let defaults: UserDefaults
    let preference: MorningGlancePreference
    let timeZone: TimeZone
    let coordinator: MorningGlanceCoordinator

    init(content: MorningGlanceContent? = glanceContent(openCount: openTaskCount), timeZoneIdentifier: String = harnessTimeZoneIdentifier) throws {
        let domain = try EmptyDomain()
        defaults = domain.defaults
        let preference = MorningGlancePreference(defaults: defaults, domainName: domain.name)
        self.preference = preference
        MorningGlancePreference.registerDefaults(in: defaults)
        defaults.set(true, forKey: MorningGlancePreference.isOnStorageKey)
        timeZone = try #require(TimeZone(identifier: timeZoneIdentifier))
        fakeContent = FakeGlanceContent(content: content)
        let clock = clock
        let fakeContent = fakeContent
        let screen = screen
        let front = front
        let panel = panel
        coordinator = MorningGlanceCoordinator(
            gate: gate,
            preference: preference,
            timeZone: timeZone,
            now: { clock.now },
            content: { fakeContent.content },
            isScreenLocked: { screen.isLocked },
            isScreenMirrored: { screen.isMirrored },
            isTodayInFront: { front.isInFront },
            showPanel: { await panel.show($0) },
            closePanel: { panel.close() }
        )
        at(today, hour: 8)
    }

    func at(_ day: CalendarDate, hour: Int, minute: Int = 0, second: TimeInterval = 0) {
        let instant = DayCloseSchedule.instant(day: day, minutesAfterMidnight: hour * minutesPerHour + minute, timeZone: timeZone)
        clock.now = instant.addingTimeInterval(second)
    }

    var lastShownDay: CalendarDate? {
        preference.lastShownDay
    }
}

@MainActor @Suite struct MorningGlanceCoordinatorTests {
    @Test func aTurnedOffGlanceShowsNothingAndMarksNothing() async throws {
        let harness = try GlanceHarness()
        harness.defaults.set(false, forKey: MorningGlancePreference.isOnStorageKey)
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 0)
        #expect(harness.lastShownDay == nil)
    }

    @Test func theFirstChanceShowsAndMarksTheDay() async throws {
        let harness = try GlanceHarness()
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 1)
        #expect(harness.lastShownDay == today)
        #expect(harness.coordinator.isShowing)
    }

    @Test func aSecondChanceTheSameDayShowsNothing() async throws {
        let harness = try GlanceHarness()
        await harness.coordinator.check()
        harness.coordinator.dismissed()
        harness.at(today, hour: 13)
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 1)
    }

    @Test func theNextDayShowsAgain() async throws {
        let harness = try GlanceHarness()
        await harness.coordinator.check()
        harness.coordinator.dismissed()
        harness.at(tomorrow, hour: 7, minute: 30)
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 2)
        #expect(harness.lastShownDay == tomorrow)
    }

    @Test func nothingOpenShowsNothingAndMarksTheDay() async throws {
        let harness = try GlanceHarness(content: glanceContent(openCount: 0))
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 0)
        #expect(harness.lastShownDay == today)
    }

    @Test func todayArrivingWithinAMinuteOfTheChanceShowsAndMarks() async throws {
        let harness = try GlanceHarness(content: nil)
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 0)
        harness.at(today, hour: 8, second: secondsOfTheCountWait / 2)
        harness.fakeContent.content = glanceContent(openCount: 2)
        await harness.coordinator.contentWaiting?.value
        #expect(harness.panel.attempts == 1)
        #expect(harness.lastShownDay == today)
    }

    @Test func todayArrivingAfterAMinuteShowsNothingAndLeavesTheDayUnmarked() async throws {
        let harness = try GlanceHarness(content: nil)
        await harness.coordinator.check()
        harness.at(today, hour: 8, second: secondsOfTheCountWait + 1)
        harness.fakeContent.content = glanceContent(openCount: 2)
        await harness.coordinator.contentWaiting?.value
        #expect(harness.panel.attempts == 0)
        #expect(harness.lastShownDay == nil)
    }

    @Test func aSignedOutChanceShowsNothingAndLeavesTheDayUnmarked() async throws {
        let harness = try GlanceHarness(content: nil)
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 0)
        #expect(harness.lastShownDay == nil)
    }

    @Test func aDueDayCloseShowsNothingAndMarksTheDay() async throws {
        let harness = try GlanceHarness()
        harness.front.isInFront = true
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 0)
        #expect(harness.lastShownDay == today)
    }

    @Test func todayAlreadyInFrontShowsNothingAndMarksTheDay() async throws {
        let harness = try GlanceHarness()
        harness.front.isInFront = true
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 0)
        #expect(harness.lastShownDay == today)
    }

    @Test func aMirroredScreenShowsNothingUnmarkedAndTheNextChanceAfterMirroringShows() async throws {
        let harness = try GlanceHarness()
        harness.screen.isMirrored = true
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 0)
        #expect(harness.lastShownDay == nil)
        harness.screen.isMirrored = false
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 1)
    }

    @Test func aLockedScreenShowsNothingUnmarkedAndTheUnlockShows() async throws {
        let harness = try GlanceHarness()
        harness.screen.isLocked = true
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 0)
        #expect(harness.lastShownDay == nil)
        harness.screen.isLocked = false
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 1)
        #expect(harness.lastShownDay == today)
    }

    @Test func anUnlockNeverDeliveredIsRetriedByTheNextAppSwitchOnlyWhileALockedChanceIsPending() async throws {
        let harness = try GlanceHarness()
        harness.screen.isLocked = true
        await harness.coordinator.check()
        harness.screen.isLocked = false
        await harness.coordinator.retryLockedChance()
        #expect(harness.panel.attempts == 1)
        let lateHarness = try GlanceHarness(content: nil)
        await lateHarness.coordinator.check()
        lateHarness.at(today, hour: 8, second: secondsOfTheCountWait + 1)
        lateHarness.fakeContent.content = glanceContent(openCount: 2)
        await lateHarness.coordinator.contentWaiting?.value
        await lateHarness.coordinator.retryLockedChance()
        #expect(lateHarness.panel.attempts == 0)
    }

    @Test func aChanceLockedAcrossMidnightIsFreshOnTheNewDay() async throws {
        let harness = try GlanceHarness()
        harness.screen.isLocked = true
        harness.at(today, hour: 23, minute: 50)
        await harness.coordinator.check()
        harness.screen.isLocked = false
        harness.at(tomorrow, hour: 7)
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 1)
        #expect(harness.lastShownDay == tomorrow)
    }

    @Test func aScreenLockedInsideTheShowClosesThePanelAndMarksNothing() async throws {
        let harness = try GlanceHarness()
        let screen = harness.screen
        harness.panel.whileShowing = { screen.isLocked = true }
        await harness.coordinator.check()
        #expect(harness.panel.closings == 1)
        #expect(harness.lastShownDay == nil)
        #expect(!harness.coordinator.isShowing)
    }

    @Test func aFocusHoldsTheGlance() async throws {
        let harness = try GlanceHarness()
        harness.gate.applyLaunchRead(isQuiet: true)
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 0)
        #expect(harness.lastShownDay == nil)
    }

    @Test func aReleaseTheSameDayShowsOnce() async throws {
        let harness = try GlanceHarness()
        harness.gate.applyLaunchRead(isQuiet: true)
        await harness.coordinator.check()
        harness.at(today, hour: 9, minute: 30)
        harness.gate.setQuiet(false)
        await harness.coordinator.releaseTaking?.value
        #expect(harness.panel.attempts == 1)
        #expect(harness.lastShownDay == today)
    }

    @Test func aReleaseOnALaterDayIsClaimedAndDropped() async throws {
        let harness = try GlanceHarness()
        harness.gate.applyLaunchRead(isQuiet: true)
        harness.at(today, hour: 23, minute: 50)
        await harness.coordinator.check()
        harness.at(tomorrow, hour: 0, minute: 10)
        harness.gate.setQuiet(false)
        await harness.coordinator.releaseTaking?.value
        #expect(harness.panel.attempts == 0)
        #expect(harness.gate.released == [])
    }

    @Test func aLaterHeldChanceMovesTheHeldDayForward() async throws {
        let harness = try GlanceHarness()
        harness.gate.applyLaunchRead(isQuiet: true)
        await harness.coordinator.check()
        harness.at(tomorrow, hour: 7)
        await harness.coordinator.check()
        harness.at(tomorrow, hour: 9)
        harness.gate.setQuiet(false)
        await harness.coordinator.releaseTaking?.value
        #expect(harness.panel.attempts == 1)
        #expect(harness.lastShownDay == tomorrow)
    }

    @Test func aReleaseWhileLockedWaitsForTheUnlock() async throws {
        let harness = try GlanceHarness()
        harness.gate.applyLaunchRead(isQuiet: true)
        await harness.coordinator.check()
        harness.screen.isLocked = true
        harness.gate.setQuiet(false)
        await harness.coordinator.releaseTaking?.value
        #expect(harness.panel.attempts == 0)
        #expect(harness.lastShownDay == nil)
        harness.screen.isLocked = false
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 1)
    }

    @Test func aReleaseWithNothingOpenMarksTheDayAndShowsNothing() async throws {
        let harness = try GlanceHarness()
        harness.gate.applyLaunchRead(isQuiet: true)
        await harness.coordinator.check()
        harness.fakeContent.content = glanceContent(openCount: 0)
        harness.gate.setQuiet(false)
        await harness.coordinator.releaseTaking?.value
        #expect(harness.panel.attempts == 0)
        #expect(harness.lastShownDay == today)
    }

    @Test func aPanelNeverSeenLeavesTheDayUnmarkedAndTheNextChanceTriesAgain() async throws {
        let harness = try GlanceHarness()
        harness.panel.answers = false
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 1)
        #expect(harness.lastShownDay == nil)
        #expect(!harness.coordinator.isShowing)
        harness.panel.answers = true
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 2)
        #expect(harness.lastShownDay == today)
    }

    @Test func aCheckWhileTheShowIsInFlightShowsNothingMore() async throws {
        let harness = try GlanceHarness()
        let coordinator = harness.coordinator
        harness.panel.whileShowing = { await coordinator.check() }
        await coordinator.check()
        #expect(harness.panel.attempts == 1)
        #expect(harness.lastShownDay == today)
    }

    @Test func aCheckWhileThePanelIsOnScreenShowsNothingMore() async throws {
        let harness = try GlanceHarness()
        await harness.coordinator.check()
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 1)
    }

    @Test func aPopoverShownDuringTheShowClosesThePanelRightAfterTheAnswerAndKeepsTheDayMarked() async throws {
        let harness = try GlanceHarness()
        let coordinator = harness.coordinator
        harness.panel.whileShowing = { coordinator.popoverShown() }
        await coordinator.check()
        #expect(harness.panel.closings == 1)
        #expect(harness.lastShownDay == today)
        #expect(!coordinator.isShowing)
    }

    @Test func todayInFrontDuringTheShowClosesThePanelRightAfterTheAnswer() async throws {
        let harness = try GlanceHarness()
        let front = harness.front
        harness.panel.whileShowing = { front.isInFront = true }
        await harness.coordinator.check()
        #expect(harness.panel.closings == 1)
        #expect(harness.lastShownDay == today)
        #expect(!harness.coordinator.isShowing)
    }

    @Test func aPopoverShownWhileThePanelIsOnScreenClosesItAndKeepsTheDayMarked() async throws {
        let harness = try GlanceHarness()
        await harness.coordinator.check()
        harness.coordinator.popoverShown()
        #expect(harness.panel.closings == 1)
        #expect(harness.lastShownDay == today)
        #expect(!harness.coordinator.isShowing)
    }

    @Test func aPopoverShownWithNothingOnScreenClosesNothing() async throws {
        let harness = try GlanceHarness()
        harness.coordinator.popoverShown()
        #expect(harness.panel.closings == 0)
    }

    @Test func closingNowClosesThePanelOnScreen() async throws {
        let harness = try GlanceHarness()
        await harness.coordinator.check()
        harness.coordinator.closeNow()
        #expect(harness.panel.closings == 1)
        #expect(!harness.coordinator.isShowing)
    }

    @Test func closingNowWithNothingOnScreenClosesNothing() async throws {
        let harness = try GlanceHarness()
        harness.coordinator.closeNow()
        #expect(harness.panel.closings == 0)
    }

    @Test func signingOutWhileShownClosesThePanel() async throws {
        let harness = try GlanceHarness()
        await harness.coordinator.check()
        harness.fakeContent.content = nil
        await harness.coordinator.shownContentReviewing?.value
        #expect(harness.panel.closings == 1)
        #expect(!harness.coordinator.isShowing)
    }

    @Test func switchingWorkspaceWhileShownClosesThePanelButAnotherTaskDoesNot() async throws {
        let harness = try GlanceHarness()
        await harness.coordinator.check()
        harness.fakeContent.content = glanceContent(openCount: openTaskCount + 1)
        await harness.coordinator.shownContentReviewing?.value
        #expect(harness.panel.closings == 0)
        harness.fakeContent.content = glanceContent(openCount: openTaskCount, workspaceIdentifier: otherWorkspaceIdentifier)
        await harness.coordinator.shownContentReviewing?.value
        #expect(harness.panel.closings == 1)
        #expect(!harness.coordinator.isShowing)
    }

    @Test func aShowThatCrossesMidnightMarksTheChancesDayAndTheNewDayGetsItsOwnChance() async throws {
        let harness = try GlanceHarness()
        harness.at(today, hour: 23, minute: 59, second: 59)
        let clock = harness.clock
        let afterMidnight = DayCloseSchedule.instant(day: tomorrow, minutesAfterMidnight: 0, timeZone: harness.timeZone).addingTimeInterval(1)
        harness.panel.whileShowing = { clock.now = afterMidnight }
        await harness.coordinator.check()
        #expect(harness.lastShownDay == today)
        harness.coordinator.dismissed()
        await harness.coordinator.check()
        #expect(harness.panel.attempts == 2)
        #expect(harness.lastShownDay == tomorrow)
    }

    @Test func theDayFollowsTheTimeZoneOfTheMac() async throws {
        let instant = DayCloseSchedule.instant(day: today, minutesAfterMidnight: 16 * minutesPerHour, timeZone: .gmt)
        let tokyo = try GlanceHarness(timeZoneIdentifier: tokyoTimeZoneIdentifier)
        let saoPaulo = try GlanceHarness()
        for harness in [tokyo, saoPaulo] {
            harness.preference.markShown(day: today)
            harness.clock.now = instant
            await harness.coordinator.check()
        }
        #expect(tokyo.panel.attempts == 1)
        #expect(saoPaulo.panel.attempts == 0)
    }

    @Test func thePanelReceivesTheContentCapturedAtTheShow() async throws {
        let harness = try GlanceHarness(content: glanceContent(openCount: 7))
        await harness.coordinator.check()
        let shown = try #require(harness.panel.shown.first)
        #expect(shown.openCount == 7)
        #expect(shown.rows.count == MorningGlanceContent.rowLimit)
        #expect(shown.restCount == 2)
    }
}
