import Foundation
import Testing
@testable import TodzKit

extension AppModelTests {
    @Test func theInboxAndAProjectAddToThemselvesWithNoDueDate() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        await harness.signedIn()
        let inbox = AddTaskDestination(projectIdentifier: "acme-inbox", dueDate: nil)
        let launch = AddTaskDestination(projectIdentifier: "acme-launch", dueDate: nil)
        #expect(harness.model.addTaskDestination(for: .inbox) == inbox)
        #expect(harness.model.addTaskDestination(for: .project(identifier: "acme-launch")) == launch)
    }

    @Test func todayAddsToTheInboxDueToday() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        let expected = AddTaskDestination(projectIdentifier: "acme-inbox", dueDate: harness.model.today)
        #expect(harness.model.addTaskDestination(for: .today) == expected)
    }

    @Test func upcomingAndDoneHaveNoDestination() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        #expect(harness.model.addTaskDestination(for: .upcoming) == nil)
        #expect(harness.model.addTaskDestination(for: .done) == nil)
    }

    @Test func aWorkspaceWithoutAnInboxHasNoDestination() async throws {
        let harness = try AppModelHarness()
        let createdAt = fixedInstant
        let garden = Project(identifier: "acme-garden", name: "Garden", isInbox: false, createdAt: createdAt)
        harness.service.workspaces.append(Workspace(identifier: "acme", name: "acme", createdAt: createdAt, projects: [garden]))
        await harness.signedIn()
        #expect(harness.model.addTaskDestination(for: .inbox) == nil)
        #expect(harness.model.addTaskDestination(for: .today) == nil)
        #expect(harness.model.addTaskDestination(for: .project(identifier: "acme-garden")) == nil)
    }

    @Test func signedOutHasNoDestination() async throws {
        let harness = try AppModelHarness()
        #expect(harness.model.addTaskDestination(for: .inbox) == nil)
        #expect(harness.model.addTaskDestination(for: .today) == nil)
    }
}
