import Foundation
import Observation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 25)
private let tomorrow = today.adding(days: 1)
private let minutesPerHour = 60
private let cachedInboxIdentifier = "acme-inbox"
private let minutesOutsideADay = [-2880, 1440]

@MainActor @Observable private final class FakeTodayCount {
    var openCount: Int?

    init(openCount: Int?) {
        self.openCount = openCount
    }
}

@MainActor private final class FakeScreen {
    var isLocked = false
}

@MainActor private final class FakePopover {
    private(set) var openings = 0
    var isOpenable = true
    var showsWhenClicked = true
    var isVisible = false

    var whileOpening: (() async -> Void)?

    func open() async -> Bool {
        openings += 1
        await whileOpening?()
        guard !isVisible else { return true }
        guard isOpenable else { return false }
        isVisible = showsWhenClicked
        return true
    }
}

@MainActor private struct DayCloseHarness {
    let gate = ProactiveGate()
    let clock = HarnessClock()
    let popover = FakePopover()
    let screen = FakeScreen()
    let defaults: UserDefaults
    let timeZone: TimeZone
    let coordinator: DayCloseCoordinator

    init(openCount: @escaping () -> Int?) throws {
        defaults = try emptyDefaults()
        DayClosePreference.registerDefaults(in: defaults)
        defaults.set(true, forKey: DayClosePreference.isOnStorageKey)
        timeZone = try #require(TimeZone(identifier: harnessTimeZoneIdentifier))
        let clock = clock
        let popover = popover
        let screen = screen
        coordinator = DayCloseCoordinator(
            gate: gate,
            defaults: defaults,
            timeZone: timeZone,
            now: { clock.now },
            openCount: openCount,
            isScreenLocked: { screen.isLocked },
            isPopoverVisible: { popover.isVisible },
            openPopover: { await popover.open() }
        )
    }

    init(count: FakeTodayCount) throws {
        try self.init { count.openCount }
    }

    func at(_ day: CalendarDate, hour: Int, minute: Int = 0) {
        clock.now = DayCloseSchedule.instant(day: day, minutesAfterMidnight: hour * minutesPerHour + minute, timeZone: timeZone)
    }

    var lastClosedDay: CalendarDate? {
        DayClosePreference.lastClosedDay(in: defaults)
    }
}

@MainActor @Suite struct DayCloseCoordinatorTests {
    @Test func aTurnedOffDayCloseOpensNothing() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.defaults.set(false, forKey: DayClosePreference.isOnStorageKey)
        harness.at(today, hour: 18)
        #expect(await harness.coordinator.check() == .off)
        #expect(harness.popover.openings == 0)
    }

    @Test func beforeTheTimeNothingOpens() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 17)
        #expect(await harness.coordinator.check() == .notYet(next: DayCloseSchedule.instant(day: today, minutesAfterMidnight: DayClosePreference.minutesAfterMidnightByDefault, timeZone: harness.timeZone)))
        #expect(harness.popover.openings == 0)
    }

    @Test func aDueDayCloseOpensInTheModeAndMarksTheDayOnce() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        let next = DayCloseSchedule.instant(day: tomorrow, minutesAfterMidnight: DayClosePreference.minutesAfterMidnightByDefault, timeZone: harness.timeZone)
        #expect(await harness.coordinator.check() == .doneToday(next: next))
        #expect(harness.popover.openings == 1)
        #expect(harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == today)
        harness.at(today, hour: 21)
        #expect(await harness.coordinator.check() == .doneToday(next: next))
        #expect(harness.popover.openings == 1)
    }

    @Test func aCheckWhileTheDayCloseIsOpeningOpensNothingMore() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        let coordinator = harness.coordinator
        harness.popover.whileOpening = { _ = await coordinator.check() }
        await coordinator.check()
        #expect(harness.popover.openings == 1)
        #expect(harness.lastClosedDay == today)
    }

    @Test func aCheckWhileTheDayCloseIsOpenOpensNothingMore() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        harness.popover.isOpenable = false
        await harness.coordinator.check()
        harness.popover.isOpenable = true
        harness.popover.whileOpening = nil
        await harness.coordinator.check()
        #expect(harness.popover.openings == 2)
        #expect(harness.coordinator.isClosingDay)
        await harness.coordinator.check()
        #expect(harness.popover.openings == 2)
    }

    @Test func dueWhileTodayIsLoadingWaitsThenOpensWhenTheCountArrives() async throws {
        let count = FakeTodayCount(openCount: nil)
        let harness = try DayCloseHarness(count: count)
        harness.at(today, hour: 18)
        #expect(await harness.coordinator.check() == .due)
        #expect(harness.popover.openings == 0)
        #expect(harness.lastClosedDay == nil)
        count.openCount = 2
        await harness.coordinator.countWaiting?.value
        #expect(harness.popover.openings == 1)
        #expect(harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == today)
    }

    @Test func dueWhileSignedOutNeitherOpensNorMarks() async throws {
        let model = try AppModelHarness().model
        await model.launch()
        #expect(model.phase == .signedOut(notice: nil))
        let harness = try DayCloseHarness { model.todayHeadingCount }
        harness.at(today, hour: 18)
        #expect(await harness.coordinator.check() == .due)
        #expect(harness.popover.openings == 0)
        #expect(!harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == nil)
    }

    @Test func dueWhileOfflineOpensOnTheCachedRowsAndAnActionIsQueuedAndShown() async throws {
        let appHarness = try AppModelHarness()
        let acme = appHarness.seedWorkspace(name: "acme")
        let cachedTasks = (1...2).map {
            MutableTask(number: $0, title: "Cached \($0)", dueDate: appHarness.model.today, orderKey: "a\($0)").record
        }
        appHarness.service.tasksOfProject[cachedInboxIdentifier] = cachedTasks
        appHarness.cache([acme], active: acme)
        appHarness.store.projects[cachedInboxIdentifier] = ProjectCache(projectIdentifier: cachedInboxIdentifier, cursor: 2, tasks: cachedTasks)
        appHarness.service.failures[.updateOwner] = .unreachable
        appHarness.service.failures[.readChanges] = .unreachable
        appHarness.service.failures[.completeTasks] = .unreachable
        appHarness.vault.secret = appHarness.session
        await appHarness.model.launch()
        let model = appHarness.model
        let harness = try DayCloseHarness { model.todayHeadingCount }
        harness.at(today, hour: 18)
        await harness.coordinator.check()
        #expect(harness.popover.openings == 1)
        #expect(harness.coordinator.isClosingDay)
        #expect(model.dayCloseTasks(lingers: CompletionLingers())?.map(\.task.title) == ["Cached 1", "Cached 2"])
        let taskViews = try #require(model.taskViews)
        let firstTask = TaskKey(projectIdentifier: cachedInboxIdentifier, number: 1)
        let lingers = CompletionLingers().toggling(task: firstTask, in: .today, views: taskViews)
        await model.complete(task: firstTask)
        #expect(model.waitingChangeCount == 1)
        #expect(model.todayHeadingCount == 1)
        #expect(model.dayCloseTasks(lingers: lingers)?.map(\.task.title) == ["Cached 1", "Cached 2"])
        #expect(model.dayCloseTasks(lingers: lingers.ending(task: firstTask))?.map(\.task.title) == ["Cached 2"])
    }

    @Test func dueWithNothingOpenMarksTheDayAndAsksNothing() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 0))
        harness.gate.setQuiet(true)
        harness.at(today, hour: 18)
        await harness.coordinator.check()
        harness.gate.setQuiet(false)
        #expect(harness.popover.openings == 0)
        #expect(!harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == today)
        #expect(harness.gate.released == [])
    }

    @Test func aClickSentAndNeverShownKeepsTheModeOnUnmarkedAndUnengagedThenShownMarks() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.popover.showsWhenClicked = false
        harness.at(today, hour: 18)
        #expect(await harness.coordinator.check() == .due)
        #expect(harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == nil)
        #expect(!harness.coordinator.acceptsKeyActions)
        harness.coordinator.popoverShown()
        #expect(harness.lastClosedDay == today)
        #expect(harness.coordinator.isClosingDay)
    }

    @Test func aLaterCheckWhileUnmarkedClicksAgainAndAShownPopoverStopsFurtherClicks() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.popover.showsWhenClicked = false
        harness.at(today, hour: 18)
        await harness.coordinator.check()
        harness.at(today, hour: 18, minute: 30)
        await harness.coordinator.check()
        #expect(harness.popover.openings == 2)
        harness.popover.isVisible = true
        harness.coordinator.popoverShown()
        harness.at(today, hour: 19)
        await harness.coordinator.check()
        #expect(harness.popover.openings == 2)
        #expect(harness.lastClosedDay == today)
    }

    @Test func aPopoverAlreadyVisibleWhenTheModeStartsMarksTheDayAtOnce() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.popover.isVisible = true
        harness.at(today, hour: 18)
        await harness.coordinator.check()
        #expect(harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == today)
    }

    @Test func noStatusButtonEndsTheModeMarksNothingAndALaterCheckThatDayOpens() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.popover.isOpenable = false
        harness.at(today, hour: 18)
        #expect(await harness.coordinator.check() == .due)
        #expect(harness.popover.openings == 1)
        #expect(!harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == nil)
        harness.popover.isOpenable = true
        harness.at(today, hour: 18, minute: 30)
        await harness.coordinator.check()
        #expect(harness.popover.openings == 2)
        #expect(harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == today)
    }

    @Test func aShownPopoverWithTheModeOffMarksNothing() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        harness.coordinator.popoverShown()
        #expect(harness.lastClosedDay == nil)
    }

    @Test func aLockedScreenOpensNothingMarksNothingAndTheNextCheckAfterTheUnlockOpens() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.screen.isLocked = true
        harness.at(today, hour: 18)
        #expect(await harness.coordinator.check() == .due)
        #expect(harness.popover.openings == 0)
        #expect(!harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == nil)
        harness.screen.isLocked = false
        harness.at(today, hour: 18, minute: 40)
        await harness.coordinator.check()
        #expect(harness.popover.openings == 1)
        #expect(harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == today)
    }

    @Test func quietFromTheLaunchReadHoldsAndAReleaseTheSameDayOpens() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.gate.applyLaunchRead(isQuiet: true)
        harness.at(today, hour: 18)
        #expect(await harness.coordinator.check() == .due)
        #expect(harness.popover.openings == 0)
        #expect(harness.lastClosedDay == nil)
        harness.at(today, hour: 18, minute: 20)
        harness.gate.setQuiet(false)
        await harness.coordinator.releaseTaking?.value
        #expect(harness.popover.openings == 1)
        #expect(harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == today)
        #expect(harness.gate.released == [])
    }

    @Test func aReleaseAfterMidnightIsClaimedAndDropped() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.gate.applyLaunchRead(isQuiet: true)
        harness.at(today, hour: 18)
        await harness.coordinator.check()
        harness.at(tomorrow, hour: 0, minute: 10)
        harness.gate.setQuiet(false)
        await harness.coordinator.releaseTaking?.value
        #expect(harness.popover.openings == 0)
        #expect(!harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == nil)
        #expect(harness.gate.released == [])
    }

    @Test func endingTheModeLeavesTheUsualToday() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        await harness.coordinator.check()
        harness.coordinator.end()
        #expect(!harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == today)
    }

    @Test func aModeStartedByTheCoordinatorIsNotEngagedAndRefusesKeyActions() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        await harness.coordinator.check()
        #expect(harness.coordinator.isClosingDay)
        #expect(!harness.coordinator.isEngaged)
        #expect(!harness.coordinator.acceptsKeyActions)
    }

    @Test func engagingTheModeAcceptsKeyActions() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        await harness.coordinator.check()
        harness.coordinator.engage()
        #expect(harness.coordinator.isEngaged)
        #expect(harness.coordinator.acceptsKeyActions)
    }

    @Test func aNewModeIsNotEngagedAgain() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        await harness.coordinator.check()
        harness.coordinator.engage()
        harness.coordinator.end()
        harness.at(tomorrow, hour: 18)
        await harness.coordinator.check()
        #expect(harness.coordinator.isClosingDay)
        #expect(!harness.coordinator.isEngaged)
        #expect(!harness.coordinator.acceptsKeyActions)
    }

    @Test func aModeLeftOnByAnOpenerThatNeverShowedDoesNotBlockTheNextDay() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        await harness.coordinator.check()
        harness.coordinator.engage()
        harness.at(tomorrow, hour: 18)
        await harness.coordinator.check()
        #expect(harness.popover.openings == 2)
        #expect(harness.lastClosedDay == tomorrow)
        #expect(!harness.coordinator.isEngaged)
    }

    @Test func aModeStartingInPlaceAfterTheOwnerEngagedIsNotEngaged() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.coordinator.engage()
        harness.at(today, hour: 18)
        await harness.coordinator.check()
        #expect(harness.coordinator.isClosingDay)
        #expect(!harness.coordinator.isEngaged)
        #expect(!harness.coordinator.acceptsKeyActions)
    }

    @Test func theUsualPopoverAcceptsKeyActions() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        #expect(!harness.coordinator.isClosingDay)
        #expect(harness.coordinator.acceptsKeyActions)
    }

    @Test(arguments: minutesOutsideADay)
    func aStoredTimeOutsideADayIsOffAndOpensNothing(minutes: Int) async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.defaults.set(minutes, forKey: DayClosePreference.timeStorageKey)
        harness.at(today, hour: 18)
        #expect(await harness.coordinator.check() == .off)
        #expect(harness.popover.openings == 0)
        #expect(harness.lastClosedDay == nil)
    }
}
