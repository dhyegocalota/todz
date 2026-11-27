import Testing
@testable import TodzKit

private let inbox = Project(identifier: "inbox", name: "Inbox", isInbox: true, createdAt: fixedInstant)
private let website = Project(identifier: "website", name: "Website relaunch", isInbox: false, createdAt: fixedInstant)
private let today = CalendarDate(year: 2026, month: 11, day: 27)
private let yesterday = CalendarDate(year: 2026, month: 11, day: 26)

private func task(
    project: Project = inbox,
    dueDate: CalendarDate? = today,
    createdBy: ChangeActor = .owner,
    workspaceName: String? = "Northwind Studio"
) -> BoardTask {
    var record = MutableTask(number: 1, dueDate: dueDate)
    record.createdBy = createdBy
    return BoardTask(project: project, task: record.record, workspaceName: workspaceName)
}

private func meta(of boardTask: BoardTask, shownWorkspaceCount: Int = 1) -> MenuBarRowMeta {
    MenuBarRowMeta(task: boardTask, today: today, shownWorkspaceCount: shownWorkspaceCount)
}

@Suite struct MenuBarRowMetaTests {
    @Test func aPlainInboxTaskDueTodayInOneWorkspaceHasNothingToSay() {
        #expect(meta(of: task()).isEmpty)
    }

    @Test func theInboxHidesItsTagAndAProjectShowsItsName() {
        #expect(meta(of: task()).projectName == nil)
        #expect(meta(of: task(project: website)).projectName == "Website relaunch")
    }

    @Test func oneWorkspaceHidesTheWorkspaceAndSeveralShowIt() {
        #expect(meta(of: task()).workspaceName == nil)
        #expect(meta(of: task(), shownWorkspaceCount: 2).workspaceName == "Northwind Studio")
    }

    @Test func overdueOnlyWhenTheDueDateIsBeforeToday() {
        #expect(meta(of: task(dueDate: yesterday)).overdue == yesterday)
        #expect(meta(of: task(dueDate: today)).overdue == nil)
        #expect(meta(of: task(dueDate: nil)).overdue == nil)
    }

    @Test func aHumanTaskHasNoAgentAndAnAgentTaskNamesItsClient() {
        #expect(meta(of: task()).agentName == nil)
        #expect(meta(of: task(createdBy: .agent(clientName: "Claude Code"))).agentName == "Claude Code")
    }

    @Test func theSecondLineSaysOverdueTheProjectAndTheWorkspaceButNeverTheAgent() {
        #expect(meta(of: task(dueDate: yesterday)).hasSubline)
        #expect(meta(of: task(project: website)).hasSubline)
        #expect(meta(of: task(), shownWorkspaceCount: 2).hasSubline)
        #expect(!meta(of: task(createdBy: .agent(clientName: "Codex"))).hasSubline)
        #expect(!meta(of: task()).hasSubline)
    }

    @Test func anySayingMakesTheMetaNotEmpty() {
        #expect(!meta(of: task(dueDate: yesterday)).isEmpty)
        #expect(!meta(of: task(project: website)).isEmpty)
        #expect(!meta(of: task(createdBy: .agent(clientName: "Codex"))).isEmpty)
        #expect(!meta(of: task(), shownWorkspaceCount: 2).isEmpty)
    }
}
