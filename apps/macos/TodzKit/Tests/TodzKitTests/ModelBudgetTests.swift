import Foundation
import Testing
@testable import TodzKit

private let readsWithoutAChange = 10
private let savesInARow = 10
private let writesAllowedForABurst = 2

@MainActor @Suite struct ModelBudgetTests {
    private func writeCount(_ harness: AppModelHarness) -> Int {
        harness.store.routes().filter { $0 == .writeProject }.count
    }

    @Test func readsOfTheViewsWithoutAChangeBuildThemOnce() async throws {
        let harness = try AppModelHarness()
        harness.seedBigProject()
        await harness.signedIn()
        let buildsBefore = harness.model.taskViewsBuildCount
        (1...readsWithoutAChange).forEach { _ in _ = harness.model.taskViews }
        let builds = harness.model.taskViewsBuildCount - buildsBefore
        #expect(builds <= 1, "views built \(builds) times")
    }

    @Test func aPulledTaskIsWrittenToTheProjectFileOffTheMainActor() async throws {
        let drains = HeldCacheDrains()
        let harness = try AppModelHarness(cacheScheduler: drains.scheduler)
        harness.seedBigProject()
        await harness.signedIn()
        await drains.runOffTheMainThread()
        let writesBefore = harness.store.mainThreadProjectWrites
        harness.seedOneMoreBigProjectTask()
        await harness.model.pullProject(identifier: bigProjectInboxIdentifier)
        await drains.runOffTheMainThread()
        let writesOnTheMainActor = harness.store.mainThreadProjectWrites - writesBefore
        #expect(writesOnTheMainActor == 0, "\(writesOnTheMainActor) project file writes on the main actor")
        #expect(harness.store.projects[bigProjectInboxIdentifier]?.tasks.count == bigProjectTaskCount + 1)
    }

    @Test func tenSavesInARowWriteTheProjectFileAtMostTwice() async throws {
        let drains = HeldCacheDrains()
        let harness = try AppModelHarness(cacheScheduler: drains.scheduler)
        harness.seedBigProject()
        await harness.signedIn()
        await drains.runOffTheMainThread()
        harness.store.calls = []
        for number in (1...savesInARow) {
            await harness.model.updateTitle(task: TaskKey(projectIdentifier: bigProjectInboxIdentifier, number: number * 2), title: "Saved \(number)")
        }
        await harness.flushed()
        await drains.runOffTheMainThread()
        #expect(writeCount(harness) <= writesAllowedForABurst, "\(writeCount(harness)) project file writes")
        #expect(harness.store.projects[bigProjectInboxIdentifier]?.tasks.first { $0.number == savesInARow * 2 }?.title == "Saved \(savesInARow)")
    }
}
