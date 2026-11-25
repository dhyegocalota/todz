import Foundation
import Testing
@testable import TodzKit

private let benchmarkSwitch = "TODZ_BENCHMARK"
private let warmUpRuns = 1
private let measuredRuns = 7
private let millisecondsPerSecond = 1_000.0
private let attosecondsPerSecond = 1e18

private func isBenchmarkOn() -> Bool {
    ProcessInfo.processInfo.environment[benchmarkSwitch] == "1"
}

private func milliseconds(_ duration: Duration) -> Double {
    (Double(duration.components.seconds) + Double(duration.components.attoseconds) / attosecondsPerSecond) * millisecondsPerSecond
}

@MainActor private func median(of work: () async -> Void) async -> Double {
    let clock = ContinuousClock()
    for _ in 1...warmUpRuns { await work() }
    var durations: [Double] = []
    for _ in 1...measuredRuns { durations.append(milliseconds(await clock.measure { await work() })) }
    return durations.sorted()[durations.count / 2]
}

@MainActor @Suite(.enabled(if: isBenchmarkOn())) struct ModelBenchmark {
    private func report(_ name: String, _ median: Double) {
        print("benchmark \(name): median \(String(format: "%.3f", median)) ms of \(measuredRuns) runs")
    }

    @Test func printsTheMediansOfTheModelsReadsAndOfOnePulledTask() async throws {
        let harness = try AppModelHarness()
        harness.seedBigProject()
        await harness.signedIn()
        let model = harness.model
        let inboxProject = bigProjectInboxIdentifier
        report("taskViews", await median { _ = model.taskViews })
        report("taskViews then inbox", await median { _ = model.taskViews?.inbox })
        report("taskViews then today", await median { _ = model.taskViews?.today })
        report("taskViews then upcomingDays", await median { _ = model.taskViews?.upcomingDays })
        report("taskViews then doneDays", await median { _ = model.taskViews?.doneDays })
        report("taskViews then project(identifier:)", await median { _ = model.taskViews?.project(identifier: inboxProject) })
        report("one pulled task applied with its cache write", await median {
            harness.seedOneMoreBigProjectTask()
            await model.pullProject(identifier: inboxProject)
        })
        report("widget snapshot after a change", await median { _ = model.widgetSnapshot })
        report("menu bar count after a change", await median { _ = model.todayHeadingCount })
    }

    @Test func printsTheMediansOfTheProjectFileOfFiveThousandTasks() async throws {
        let folder = FileManager.default.temporaryDirectory.appending(path: "todz-benchmark-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = FileSyncStore(folder: folder)
        let tasks = (1...bigProjectTaskCount).map { OwnerFixtures.openTask(number: $0) }
        let cache = ProjectCache(projectIdentifier: bigProjectInboxIdentifier, cursor: bigProjectTaskCount, tasks: tasks)
        report("project file write of \(bigProjectTaskCount) tasks", await median { try? store.writeProject(cache) })
        report("project file read and decode of \(bigProjectTaskCount) tasks", await median { _ = try? store.readProject(identifier: bigProjectInboxIdentifier) })
    }
}
