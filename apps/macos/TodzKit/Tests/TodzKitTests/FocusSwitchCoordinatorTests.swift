import Foundation
import Testing
@testable import TodzKit

@MainActor private final class FilterReads {
    private(set) var count = 0
    private var waiting: CheckedContinuation<Bool, Never>?
    private var queued: Bool?

    func read() async -> Bool {
        count += 1
        guard let queued else { return await withCheckedContinuation { waiting = $0 } }
        self.queued = nil
        return queued
    }

    func answer(isQuiet: Bool) {
        guard let waiting else {
            queued = isQuiet
            return
        }
        waiting.resume(returning: isQuiet)
        self.waiting = nil
    }
}

@MainActor private struct FocusSwitchBench {
    let domain: EmptyDomain
    let gate: ProactiveGate
    let reads = FilterReads()
    let coordinator: FocusSwitchCoordinator

    init(isOn: Bool, waitsForTimeout: Bool = true) throws {
        domain = try EmptyDomain()
        domain.defaults.set(isOn, forKey: RespectFocusPreference.isOnStorageKey)
        gate = ProactiveGate(respectsFocus: isOn)
        let reads = reads
        coordinator = FocusSwitchCoordinator(
            gate: gate,
            preference: RespectFocusPreference(defaults: domain.defaults, domainName: domain.name),
            readFilter: { await reads.read() },
            pause: { duration in
                guard waitsForTimeout else { return }
                try await Task.sleep(for: duration)
            }
        )
    }

    func setSwitch(_ isOn: Bool) {
        domain.defaults.set(isOn, forKey: RespectFocusPreference.isOnStorageKey)
    }

    func startAnswering(isQuiet: Bool) async {
        reads.answer(isQuiet: isQuiet)
        await coordinator.start()
    }
}

@MainActor @Suite struct FocusSwitchCoordinatorTests {
    @Test func withTheSwitchOffAtStartTheFilterIsNeverReadAndTheGateIsOpen() async throws {
        let bench = try FocusSwitchBench(isOn: false)
        await bench.coordinator.start()
        #expect(bench.reads.count == 0)
        #expect(!bench.gate.isQuiet)
        #expect(bench.gate.admit(.dayClose) == .show)
    }

    @Test func withTheSwitchOnAtStartTheFilterIsReadOnceAndItsAnswerReachesTheGate() async throws {
        let bench = try FocusSwitchBench(isOn: true)
        await bench.startAnswering(isQuiet: true)
        #expect(bench.reads.count == 1)
        #expect(bench.gate.isQuiet)
        #expect(bench.gate.admit(.morningGlance) == .held)
    }

    @Test func aReadThatOutlastsTheTimeoutQuietsTheGateAndItsLaterAnswerReleasesIt() async throws {
        let bench = try FocusSwitchBench(isOn: true, waitsForTimeout: false)
        await bench.coordinator.start()
        #expect(bench.gate.isQuiet)
        #expect(bench.gate.admit(.dayClose) == .held)
        bench.reads.answer(isQuiet: false)
        await bench.coordinator.reading?.value
        #expect(!bench.gate.isQuiet)
        #expect(bench.gate.released == [.dayClose])
    }

    @Test func turningTheSwitchOnReadsTheFilterOnce() async throws {
        let bench = try FocusSwitchBench(isOn: false)
        await bench.coordinator.start()
        bench.setSwitch(true)
        bench.reads.answer(isQuiet: true)
        await bench.coordinator.preferencesChanged()
        #expect(bench.reads.count == 1)
        #expect(bench.gate.isQuiet)
    }

    @Test func turningTheSwitchOffReadsNothingAndOpensTheGate() async throws {
        let bench = try FocusSwitchBench(isOn: true)
        await bench.startAnswering(isQuiet: true)
        #expect(bench.gate.admit(.dayClose) == .held)
        bench.setSwitch(false)
        await bench.coordinator.preferencesChanged()
        #expect(bench.reads.count == 1)
        #expect(!bench.gate.isQuiet)
        #expect(bench.gate.released == [.dayClose])
    }

    @Test func aPerformBeforeTheReadWinsOverIt() async throws {
        let bench = try FocusSwitchBench(isOn: true)
        bench.gate.setQuiet(true)
        bench.reads.answer(isQuiet: false)
        await bench.coordinator.start()
        #expect(bench.gate.isQuiet)
    }

    @Test func aDefaultsChangeThatDoesNotFlipTheSwitchReadsNothing() async throws {
        let bench = try FocusSwitchBench(isOn: true)
        await bench.startAnswering(isQuiet: false)
        bench.domain.defaults.set("2026-11-25", forKey: "lastClosedDay")
        await bench.coordinator.preferencesChanged()
        bench.setSwitch(true)
        await bench.coordinator.preferencesChanged()
        #expect(bench.reads.count == 1)
    }
}
