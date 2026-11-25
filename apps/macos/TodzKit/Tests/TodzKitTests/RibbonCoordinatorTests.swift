import Foundation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 25)
private let minutesPerHour = 60
private let fittingWidth = 150.0
private let longWait = Duration.seconds(60)
private let storedCloseMinutes = 17 * minutesPerHour + 30
private let unknownCadence = "weekly"
private let threeOpen = RibbonContent.remaining(left: 3, next: RibbonTask(number: 12, title: "Review PR"))
private let twoOpen = RibbonContent.remaining(left: 2, next: RibbonTask(number: 13, title: "Write notes"))
private let fittingTimeline = RibbonMotion.timeline(textWidth: fittingWidth, isMotionReduced: false)

private func shown(_ content: RibbonContent, frames: [RibbonFrame] = fittingTimeline) -> [RibbonPresentation?] {
    frames.map { RibbonPresentation(content: content, frame: $0, textWidth: fittingWidth, isMotionReduced: false) }
}

@MainActor private final class RibbonWorld {
    var content: RibbonContent? = threeOpen
    var isLocked = false
    var isPopoverVisible = false
    var isMotionReduced = false
    var isDayCloseOn = false
    private(set) var widthAsks = 0

    func askWidth() -> Double {
        widthAsks += 1
        return fittingWidth
    }
}

@MainActor private struct RibbonPauses {
    let waits = HeldPause()
    let moments = HeldPause()

    func pause(_ duration: Duration) async throws {
        let target = duration >= longWait ? waits : moments
        try await target.pause(duration)
    }
}

@MainActor private struct RibbonBench {
    let gate = ProactiveGate(respectsFocus: true)
    let clock = HarnessClock()
    let pauses = RibbonPauses()
    let world = RibbonWorld()
    let domain: EmptyDomain
    let timeZone: TimeZone
    let coordinator: RibbonCoordinator

    init(cadence: RibbonCadence = .hourly, isOn: Bool = true, isDayCloseOn: Bool = false, hour: Int, minute: Int = 0) throws {
        domain = try EmptyDomain()
        RibbonPreference.registerDefaults(in: domain.defaults)
        domain.defaults.set(isOn, forKey: RibbonPreference.isOnStorageKey)
        domain.defaults.set(cadence.rawValue, forKey: RibbonPreference.cadenceStorageKey)
        timeZone = try #require(TimeZone(identifier: harnessTimeZoneIdentifier))
        world.isDayCloseOn = isDayCloseOn
        let clock = clock
        let pauses = pauses
        let world = world
        coordinator = RibbonCoordinator(
            gate: gate,
            preference: RibbonPreference(defaults: domain.defaults, domainName: domain.name),
            isDayCloseOn: { world.isDayCloseOn },
            timeZone: timeZone,
            now: { clock.now },
            pause: { try await pauses.pause($0) },
            content: { world.content },
            isScreenLocked: { world.isLocked },
            isPopoverVisible: { world.isPopoverVisible },
            isMotionReduced: { world.isMotionReduced },
            textWidth: { _ in world.askWidth() }
        )
        at(hour: hour, minute: minute)
    }

    func at(_ day: CalendarDate = today, hour: Int, minute: Int = 0) {
        clock.now = DayCloseSchedule.instant(day: day, minutesAfterMidnight: hour * minutesPerHour + minute, timeZone: timeZone)
    }

    func armed() async {
        coordinator.refresh()
        await pauses.waits.started()
    }

    func playOut(after priorPauses: Int = 0) async -> [RibbonPresentation?] {
        await pauses.moments.started(count: priorPauses + 1)
        let playing = coordinator.running
        var seen: [RibbonPresentation?] = []
        for index in 0..<fittingTimeline.count {
            await pauses.moments.started(count: priorPauses + index + 1)
            seen.append(coordinator.presentation)
            pauses.moments.release()
        }
        await playing?.value
        return seen
    }

    func settled(_ pause: HeldPause, heldCount: Int) async {
        while pause.heldCount != heldCount { await Task.yield() }
    }
}

@MainActor @Suite struct RibbonCoordinatorTests {
    @Test func aTurnedOffRibbonArmsNothing() throws {
        let bench = try RibbonBench(isOn: false, hour: 10, minute: 20)
        bench.coordinator.refresh()
        #expect(bench.coordinator.waiting == nil)
        #expect(bench.coordinator.presentation == nil)
    }

    @Test func everyHourArmsOneWaitUntilTheNextHour() async throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        await bench.armed()
        #expect(bench.pauses.waits.durations == [.seconds(2_400)])
    }

    @Test func aBoundaryUnfoldsHoldsAndFoldsTheLineThenArmsTheNextHour() async throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        await bench.armed()
        bench.at(hour: 11)
        bench.pauses.waits.release()
        #expect(await bench.playOut() == shown(threeOpen))
        #expect(bench.coordinator.presentation == nil)
        await bench.pauses.waits.started(count: 2)
        #expect(bench.pauses.waits.durations == [.seconds(2_400), .seconds(3_600)])
    }

    @Test func withNothingToSayAtTheBoundaryThereIsNoRibbonAndTheNextWaitIsArmed() async throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        bench.world.content = nil
        await bench.armed()
        bench.at(hour: 11)
        bench.pauses.waits.release()
        await bench.pauses.waits.started(count: 2)
        #expect(bench.coordinator.presentation == nil)
        #expect(bench.pauses.moments.durations.isEmpty)
        #expect(bench.pauses.waits.durations == [.seconds(2_400), .seconds(3_600)])
    }

    @Test func anOpenPopoverSkipsTheRibbonWithoutHoldingIt() async throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        bench.gate.setQuiet(true)
        bench.world.isPopoverVisible = true
        await bench.armed()
        bench.at(hour: 11)
        bench.pauses.waits.release()
        await bench.pauses.waits.started(count: 2)
        bench.gate.setQuiet(false)
        #expect(bench.gate.released.isEmpty)
        #expect(bench.pauses.moments.durations.isEmpty)
    }

    @Test func aLockedScreenSkipsTheRibbonWithoutHoldingIt() async throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        bench.gate.setQuiet(true)
        bench.world.isLocked = true
        await bench.armed()
        bench.at(hour: 11)
        bench.pauses.waits.release()
        await bench.pauses.waits.started(count: 2)
        bench.gate.setQuiet(false)
        #expect(bench.gate.released.isEmpty)
        #expect(bench.pauses.moments.durations.isEmpty)
    }

    @Test func aSecondBoundaryWhileARibbonShowsIsDropped() async throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        await bench.armed()
        bench.at(hour: 11)
        bench.pauses.waits.release()
        await bench.pauses.moments.started()
        bench.coordinator.refresh()
        await bench.pauses.waits.started(count: 2)
        bench.at(hour: 12)
        bench.pauses.waits.release()
        #expect(await bench.playOut() == shown(threeOpen))
        await bench.pauses.waits.started(count: 3)
        #expect(bench.world.widthAsks == 1)
        #expect(bench.pauses.moments.durations.count == fittingTimeline.count)
    }

    @Test func aQuietGateHoldsTheBoundaryAndTheReleaseShowsTheLineOfThatMomentOnce() async throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        bench.gate.setQuiet(true)
        await bench.armed()
        bench.at(hour: 11)
        bench.pauses.waits.release()
        await bench.pauses.waits.started(count: 2)
        #expect(bench.coordinator.presentation == nil)
        #expect(bench.pauses.moments.durations.isEmpty)
        bench.world.content = twoOpen
        bench.gate.setQuiet(false)
        #expect(await bench.playOut() == shown(twoOpen))
        await bench.coordinator.releaseTaking?.value
        #expect(bench.gate.released.isEmpty)
        #expect(bench.pauses.moments.durations.count == fittingTimeline.count)
    }

    @Test func aGateThatTurnsQuietMidRibbonEndsItAtOnceAndNoLaterFrameLands() async throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        await bench.armed()
        bench.at(hour: 11)
        bench.pauses.waits.release()
        await bench.pauses.moments.started()
        #expect(bench.coordinator.presentation != nil)
        bench.gate.setQuiet(true)
        await bench.coordinator.quietEnding?.value
        #expect(bench.coordinator.presentation == nil)
        await bench.settled(bench.pauses.moments, heldCount: 0)
        #expect(bench.pauses.moments.durations.count == 1)
    }

    @Test func endingMidRibbonClearsThePresentationAtOnceAndNoLaterFrameLands() async throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        await bench.armed()
        bench.at(hour: 11)
        bench.pauses.waits.release()
        await bench.pauses.moments.started()
        bench.coordinator.end()
        #expect(bench.coordinator.presentation == nil)
        #expect(bench.coordinator.running == nil)
        await bench.settled(bench.pauses.moments, heldCount: 0)
        #expect(bench.pauses.moments.durations.count == 1)
    }

    @Test func endingWithNoRibbonShowingChangesNothing() throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        bench.coordinator.end()
        #expect(bench.coordinator.presentation == nil)
    }

    @Test func turningTheSwitchOffMidRibbonAndRefreshingEndsItAtOnce() async throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        await bench.armed()
        bench.at(hour: 11)
        bench.pauses.waits.release()
        await bench.pauses.moments.started()
        bench.domain.defaults.set(false, forKey: RibbonPreference.isOnStorageKey)
        bench.coordinator.refresh()
        #expect(bench.coordinator.presentation == nil)
        #expect(bench.coordinator.waiting == nil)
    }

    @Test func theCloseOfTheDayStaysSilentWhileCloseTheDayItselfIsOn() async throws {
        let bench = try RibbonBench(cadence: .dayClose, isDayCloseOn: true, hour: 17)
        await bench.armed()
        #expect(bench.pauses.waits.durations == [.seconds(3_600)])
        bench.at(hour: 18)
        bench.pauses.waits.release()
        await bench.pauses.waits.started(count: 2)
        #expect(bench.coordinator.presentation == nil)
        #expect(bench.pauses.moments.durations.isEmpty)
        #expect(bench.pauses.waits.durations == [.seconds(3_600), .seconds(86_400)])
    }

    @Test func theCloseOfTheDayShowsOnceWhenCloseTheDayIsOffAndArmsTomorrow() async throws {
        let bench = try RibbonBench(cadence: .dayClose, hour: 17)
        await bench.armed()
        bench.at(hour: 18)
        bench.pauses.waits.release()
        #expect(await bench.playOut() == shown(threeOpen))
        await bench.pauses.waits.started(count: 2)
        #expect(bench.pauses.waits.durations == [.seconds(3_600), .seconds(86_400)])
    }

    @Test func theCloseOfTheDayFollowsTheTimeTheOwnerStored() async throws {
        let bench = try RibbonBench(cadence: .dayClose, hour: 17)
        bench.domain.defaults.set(storedCloseMinutes, forKey: DayClosePreference.timeStorageKey)
        await bench.armed()
        #expect(bench.pauses.waits.durations == [.seconds(1_800)])
    }

    @Test func anAgentChangeWaitsForTheBurstToSettleThenShows() async throws {
        let bench = try RibbonBench(cadence: .agentChange, hour: 14)
        bench.coordinator.agentChanged()
        await bench.pauses.moments.started()
        #expect(bench.pauses.moments.durations == [.seconds(RibbonCoordinator.agentSettle)])
        #expect(bench.coordinator.presentation == nil)
        bench.pauses.moments.release()
        #expect(await bench.playOut(after: 1) == shown(threeOpen))
    }

    @Test func twoAgentChangesASecondApartShowOnceAfterTheSecondSettles() async throws {
        let bench = try RibbonBench(cadence: .agentChange, hour: 14)
        bench.coordinator.agentChanged()
        await bench.pauses.moments.started()
        bench.coordinator.agentChanged()
        await bench.pauses.moments.started(count: 2)
        await bench.settled(bench.pauses.moments, heldCount: 1)
        bench.pauses.moments.release()
        #expect(await bench.playOut(after: 2) == shown(threeOpen))
        #expect(bench.pauses.moments.durations.count == 2 + fittingTimeline.count)
    }

    @Test func anAgentChangeFiveMinutesAfterAShownAgentRibbonIsDropped() async throws {
        let bench = try RibbonBench(cadence: .agentChange, hour: 14)
        bench.coordinator.agentChanged()
        await bench.pauses.moments.started()
        bench.pauses.moments.release()
        _ = await bench.playOut(after: 1)
        bench.clock.now = bench.clock.now.addingTimeInterval(5 * 60)
        let settling = bench.coordinator.settling
        bench.coordinator.agentChanged()
        #expect(bench.coordinator.settling == settling)
    }

    @Test func anAgentChangeTenMinutesAfterAShownAgentRibbonShows() async throws {
        let bench = try RibbonBench(cadence: .agentChange, hour: 14)
        bench.coordinator.agentChanged()
        await bench.pauses.moments.started()
        bench.pauses.moments.release()
        _ = await bench.playOut(after: 1)
        bench.clock.now = bench.clock.now.addingTimeInterval(RibbonCoordinator.agentCooldown)
        let prior = 1 + fittingTimeline.count
        bench.coordinator.agentChanged()
        await bench.pauses.moments.started(count: prior + 1)
        #expect(bench.pauses.moments.durations.last == .seconds(RibbonCoordinator.agentSettle))
    }

    @Test func anAgentChangeHeldByAQuietGateShowsOnceOnReleaseAndStartsTheCooldownThere() async throws {
        let bench = try RibbonBench(cadence: .agentChange, hour: 14)
        bench.gate.setQuiet(true)
        bench.coordinator.agentChanged()
        await bench.pauses.moments.started()
        bench.pauses.moments.release()
        await bench.coordinator.settling?.value
        #expect(bench.coordinator.presentation == nil)
        bench.gate.setQuiet(false)
        #expect(await bench.playOut(after: 1) == shown(threeOpen))
        bench.clock.now = bench.clock.now.addingTimeInterval(5 * 60)
        let settling = bench.coordinator.settling
        bench.coordinator.agentChanged()
        #expect(bench.coordinator.settling == settling)
        #expect(bench.pauses.moments.durations.count == 1 + fittingTimeline.count)
    }

    @Test func anAgentChangeWithTheHourlyCadenceDoesNothing() throws {
        let bench = try RibbonBench(hour: 14)
        bench.coordinator.agentChanged()
        #expect(bench.coordinator.settling == nil)
    }

    @Test func anUnknownStoredCadenceShowsNothingAtAnyBoundary() throws {
        let bench = try RibbonBench(hour: 14)
        bench.domain.defaults.set(unknownCadence, forKey: RibbonPreference.cadenceStorageKey)
        bench.coordinator.refresh()
        bench.coordinator.agentChanged()
        #expect(bench.coordinator.waiting == nil)
        #expect(bench.coordinator.settling == nil)
    }

    @Test func refreshingTwiceKeepsOnePendingWait() async throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        await bench.armed()
        bench.coordinator.refresh()
        await bench.pauses.waits.started(count: 2)
        await bench.settled(bench.pauses.waits, heldCount: 1)
        #expect(bench.pauses.waits.heldCount == 1)
    }

    @Test func reducedMotionIsOneFrameOfFiveSeconds() async throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        bench.world.isMotionReduced = true
        await bench.armed()
        bench.at(hour: 11)
        bench.pauses.waits.release()
        await bench.pauses.moments.started()
        let frame = RibbonFrame(reveal: 1, offset: 0, duration: .seconds(5))
        #expect(bench.coordinator.presentation == RibbonPresentation(content: threeOpen, frame: frame, textWidth: fittingWidth, isMotionReduced: true))
        #expect(bench.pauses.moments.durations == [.seconds(5)])
    }

    @Test func theTextWidthIsAskedOncePerRibbon() async throws {
        let bench = try RibbonBench(hour: 10, minute: 20)
        await bench.armed()
        bench.at(hour: 11)
        bench.pauses.waits.release()
        _ = await bench.playOut()
        #expect(bench.world.widthAsks == 1)
    }
}
