import Foundation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 25)
private let tomorrow = today.adding(days: 1)
private let secondsPerHour = 3_600.0

private final class ClockSwitch {
    var isOn = true
}

@MainActor private struct ClockBench {
    let now = HarnessClock()
    let pause = HeldPause()
    let setting = ClockSwitch()
    let clock: DayTemperatureClock
    let timeZone: TimeZone

    init(hour: Int, minute: Int = 0) throws {
        let timeZone = try #require(TimeZone(identifier: harnessTimeZoneIdentifier))
        let now = now
        let pause = pause
        let setting = setting
        self.timeZone = timeZone
        self.now.now = try Self.instant(day: today, hour: hour, minute: minute, timeZone: timeZone)
        clock = DayTemperatureClock(
            now: { now.now },
            timeZone: { timeZone },
            isOn: { setting.isOn },
            pause: { try await pause.pause($0) }
        )
    }

    func move(to day: CalendarDate, hour: Int) throws {
        now.now = try Self.instant(day: day, hour: hour, minute: 0, timeZone: timeZone)
    }

    private static func instant(day: CalendarDate, hour: Int, minute: Int, timeZone: TimeZone) throws -> Date {
        let components = DateComponents(year: day.year, month: day.month, day: day.day, hour: hour, minute: minute)
        return try #require(gregorianCalendar(in: timeZone).date(from: components))
    }
}

@MainActor @Suite struct DayTemperatureClockTests {
    @Test func refreshingBeforeNoonIsPlainAndWaitsUntilNoon() async throws {
        let bench = try ClockBench(hour: 11, minute: 30)
        bench.clock.refresh()
        await bench.pause.started()
        #expect(bench.clock.step == .plain)
        #expect(bench.pause.durations == [.seconds(1_800)])
    }

    @Test func aReleaseAtNoonSetsTheNoonStepAndWaitsUntilThreeInTheAfternoon() async throws {
        let bench = try ClockBench(hour: 11, minute: 30)
        bench.clock.refresh()
        await bench.pause.started()
        try bench.move(to: today, hour: 12)
        bench.pause.release()
        await bench.pause.started(count: 2)
        #expect(bench.clock.step == .noon)
        #expect(bench.pause.durations.last == .seconds(3 * secondsPerHour))
    }

    @Test func aReleaseAtThreeSetsTheAfternoonStepAndWaitsUntilSix() async throws {
        let bench = try ClockBench(hour: 14)
        bench.clock.refresh()
        await bench.pause.started()
        try bench.move(to: today, hour: 15)
        bench.pause.release()
        await bench.pause.started(count: 2)
        #expect(bench.clock.step == .afternoon)
        #expect(bench.pause.durations.last == .seconds(3 * secondsPerHour))
    }

    @Test func aReleaseAtSixSetsTheEveningStepAndWaitsUntilTheNextDayStarts() async throws {
        let bench = try ClockBench(hour: 17)
        bench.clock.refresh()
        await bench.pause.started()
        try bench.move(to: today, hour: 18)
        bench.pause.release()
        await bench.pause.started(count: 2)
        #expect(bench.clock.step == .evening)
        #expect(bench.pause.durations.last == .seconds(6 * secondsPerHour))
    }

    @Test func aReleaseAtMidnightIsPlainAgainAndWaitsUntilNoon() async throws {
        let bench = try ClockBench(hour: 23)
        bench.clock.refresh()
        await bench.pause.started()
        try bench.move(to: tomorrow, hour: 0)
        bench.pause.release()
        await bench.pause.started(count: 2)
        #expect(bench.clock.step == .plain)
        #expect(bench.pause.durations.last == .seconds(12 * secondsPerHour))
    }

    @Test func aRefreshDuringAWaitCancelsTheEarlierWait() async throws {
        let bench = try ClockBench(hour: 11, minute: 30)
        bench.clock.refresh()
        await bench.pause.started()
        let earlier = bench.clock.waiting
        bench.clock.refresh()
        await earlier?.value
        await bench.pause.started(count: 2)
        #expect(bench.pause.heldCount == 1)
    }

    @Test func aSwitchedOffSettingIsPlainAndWaitsForNothing() async throws {
        let bench = try ClockBench(hour: 13)
        bench.setting.isOn = false
        bench.clock.refresh()
        #expect(bench.clock.step == .plain)
        #expect(bench.pause.durations == [])
    }

    @Test func switchingTheSettingOffDropsTheStepAndTheWait() async throws {
        let bench = try ClockBench(hour: 13)
        bench.clock.refresh()
        await bench.pause.started()
        #expect(bench.clock.step == .noon)
        let earlier = bench.clock.waiting
        bench.setting.isOn = false
        bench.clock.refresh()
        await earlier?.value
        #expect(bench.clock.step == .plain)
        #expect(bench.pause.heldCount == 0)
    }
}
