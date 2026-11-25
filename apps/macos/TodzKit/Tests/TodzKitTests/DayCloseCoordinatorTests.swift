import Foundation
import Observation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 25)
private let tomorrow = today.adding(days: 1)
private let minutesPerHour = 60

@MainActor @Observable private final class FakeTodayCount {
    var openCount: Int?

    init(openCount: Int?) {
        self.openCount = openCount
    }
}

@MainActor private final class FakePopover {
    private(set) var openings = 0
    var isOpenable = true

    func open() -> Bool {
        openings += 1
        return isOpenable
    }
}

@MainActor private struct DayCloseHarness {
    let gate = ProactiveGate()
    let clock = HarnessClock()
    let popover = FakePopover()
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
        coordinator = DayCloseCoordinator(
            gate: gate,
            defaults: defaults,
            timeZone: timeZone,
            now: { clock.now },
            openCount: openCount,
            openPopover: { popover.open() }
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
    @Test func aTurnedOffDayCloseOpensNothing() throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.defaults.set(false, forKey: DayClosePreference.isOnStorageKey)
        harness.at(today, hour: 18)
        #expect(harness.coordinator.check() == .off)
        #expect(harness.popover.openings == 0)
    }

    @Test func beforeTheTimeNothingOpens() throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 17)
        #expect(harness.coordinator.check() == .notYet(next: DayCloseSchedule.instant(day: today, minutesAfterMidnight: DayClosePreference.minutesAfterMidnightByDefault, timeZone: harness.timeZone)))
        #expect(harness.popover.openings == 0)
    }

    @Test func aDueDayCloseOpensInTheModeAndMarksTheDayOnce() throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        let next = DayCloseSchedule.instant(day: tomorrow, minutesAfterMidnight: DayClosePreference.minutesAfterMidnightByDefault, timeZone: harness.timeZone)
        #expect(harness.coordinator.check() == .doneToday(next: next))
        #expect(harness.popover.openings == 1)
        #expect(harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == today)
        harness.at(today, hour: 21)
        #expect(harness.coordinator.check() == .doneToday(next: next))
        #expect(harness.popover.openings == 1)
    }

    @Test func dueWhileTodayIsLoadingWaitsThenOpensWhenTheCountArrives() async throws {
        let count = FakeTodayCount(openCount: nil)
        let harness = try DayCloseHarness(count: count)
        harness.at(today, hour: 18)
        #expect(harness.coordinator.check() == .due)
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
        #expect(harness.coordinator.check() == .due)
        #expect(harness.popover.openings == 0)
        #expect(!harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == nil)
    }

    @Test func dueWithNothingOpenMarksTheDayAndAsksNothing() throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 0))
        harness.gate.setQuiet(true)
        harness.at(today, hour: 18)
        harness.coordinator.check()
        harness.gate.setQuiet(false)
        #expect(harness.popover.openings == 0)
        #expect(!harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == today)
        #expect(harness.gate.released == [])
    }

    @Test func anOpenerThatFailsMarksNothingAndALaterCheckThatDayOpens() throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.popover.isOpenable = false
        harness.at(today, hour: 18)
        #expect(harness.coordinator.check() == .due)
        #expect(harness.popover.openings == 1)
        #expect(!harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == nil)
        harness.popover.isOpenable = true
        harness.at(today, hour: 18, minute: 30)
        harness.coordinator.check()
        #expect(harness.popover.openings == 2)
        #expect(harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == today)
    }

    @Test func quietFromTheLaunchReadHoldsAndAReleaseTheSameDayOpens() async throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.gate.applyLaunchRead(isQuiet: true)
        harness.at(today, hour: 18)
        #expect(harness.coordinator.check() == .due)
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
        harness.coordinator.check()
        harness.at(tomorrow, hour: 0, minute: 10)
        harness.gate.setQuiet(false)
        await harness.coordinator.releaseTaking?.value
        #expect(harness.popover.openings == 0)
        #expect(!harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == nil)
        #expect(harness.gate.released == [])
    }

    @Test func endingTheModeLeavesTheUsualToday() throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        harness.coordinator.check()
        harness.coordinator.end()
        #expect(!harness.coordinator.isClosingDay)
        #expect(harness.lastClosedDay == today)
    }

    @Test func aModeStartedByTheCoordinatorIsNotEngagedAndRefusesKeyActions() throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        harness.coordinator.check()
        #expect(harness.coordinator.isClosingDay)
        #expect(!harness.coordinator.isEngaged)
        #expect(!harness.coordinator.acceptsKeyActions)
    }

    @Test func engagingTheModeAcceptsKeyActions() throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        harness.coordinator.check()
        harness.coordinator.engage()
        #expect(harness.coordinator.isEngaged)
        #expect(harness.coordinator.acceptsKeyActions)
    }

    @Test func aNewModeIsNotEngagedAgain() throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.at(today, hour: 18)
        harness.coordinator.check()
        harness.coordinator.engage()
        harness.coordinator.end()
        harness.at(tomorrow, hour: 18)
        harness.coordinator.check()
        #expect(harness.coordinator.isClosingDay)
        #expect(!harness.coordinator.isEngaged)
        #expect(!harness.coordinator.acceptsKeyActions)
    }

    @Test func aModeStartingInPlaceAfterTheOwnerEngagedIsNotEngaged() throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        harness.coordinator.engage()
        harness.at(today, hour: 18)
        harness.coordinator.check()
        #expect(harness.coordinator.isClosingDay)
        #expect(!harness.coordinator.isEngaged)
        #expect(!harness.coordinator.acceptsKeyActions)
    }

    @Test func theUsualPopoverAcceptsKeyActions() throws {
        let harness = try DayCloseHarness(count: FakeTodayCount(openCount: 2))
        #expect(!harness.coordinator.isClosingDay)
        #expect(harness.coordinator.acceptsKeyActions)
    }
}
