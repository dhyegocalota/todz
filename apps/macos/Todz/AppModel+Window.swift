import TodzKit

extension AppModel {
    var isSignedIn: Bool {
        guard case .signedOut = phase else { return true }
        return false
    }

    var isReady: Bool {
        phase == .ready
    }

    var selectedBoardTask: BoardTask? {
        guard let selectedTask else { return nil }
        return boardTask(selectedTask)
    }

    var manualOrderTasks: [BoardTask]? {
        guard let taskViews else { return nil }
        switch selectedItem {
        case .inbox: return taskViews.inbox
        case let .project(identifier): return taskViews.project(identifier: identifier)
        case .today, .upcoming, .done: return nil
        }
    }

    var addTaskDestination: AddTaskDestination? {
        guard let inbox = activeWorkspace?.projects.first(where: \.isInbox) else { return nil }
        switch selectedItem {
        case .inbox: return AddTaskDestination(projectIdentifier: inbox.identifier, dueDate: nil)
        case .today: return AddTaskDestination(projectIdentifier: inbox.identifier, dueDate: today)
        case let .project(identifier): return AddTaskDestination(projectIdentifier: identifier, dueDate: nil)
        case .upcoming, .done: return nil
        }
    }

    func boardTask(_ key: TaskKey) -> BoardTask? {
        guard let taskViews else { return nil }
        let candidates = taskViews.project(identifier: key.projectIdentifier) + taskViews.done
        return candidates.first { $0.key == key }
    }

    func ruleIssue(task key: TaskKey, field: TaskWriteField) -> RuleIssue? {
        ruleIssues[.taskField(key, field)]
    }

    func placement(task key: TaskKey, direction: TaskMoveDirection) -> TaskPlacement? {
        guard let tasks = manualOrderTasks else { return nil }
        let isInTheList = tasks.contains { $0.key == key }
        guard isInTheList else { return nil }
        return TaskPlacementRequest.placement(openNumbers: tasks.map(\.task.number), moving: key.number, direction: direction)
    }

    func move(task key: TaskKey, direction: TaskMoveDirection) async {
        guard let placement = placement(task: key, direction: direction) else { return }
        await move(task: key, placement: placement)
    }

    func toggleDone(task key: TaskKey) async {
        guard let boardTask = boardTask(key) else { return }
        switch boardTask.task.state {
        case .open: await complete(task: key)
        case .done: await reopen(task: key)
        }
    }

    func openCount(of item: SidebarItem) -> Int? {
        guard let taskViews, let projects = activeWorkspace?.projects else { return nil }
        let isEveryProjectLoaded = projects.allSatisfy { projectLoads[$0.identifier] == .loaded }
        switch item {
        case .inbox:
            guard let inbox = projects.first(where: \.isInbox) else { return nil }
            guard projectLoads[inbox.identifier] == .loaded else { return nil }
            return taskViews.inbox.count
        case .today:
            guard isEveryProjectLoaded else { return nil }
            return taskViews.today.open.count
        case .upcoming:
            guard isEveryProjectLoaded else { return nil }
            return taskViews.upcoming.count
        case .done:
            return nil
        case let .project(identifier):
            guard projectLoads[identifier] == .loaded else { return nil }
            return taskViews.project(identifier: identifier).count
        }
    }
}
