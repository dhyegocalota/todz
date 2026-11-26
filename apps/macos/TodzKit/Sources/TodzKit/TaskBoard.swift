import Foundation

private let keyPaddingDigit: Character = "0"

private typealias Overlay = (board: TaskBoard, movedTasks: Set<TaskKey>)

private func displayOrderKey(position: Int, count: Int) -> String {
    let digits = String(position)
    return String(repeating: keyPaddingDigit, count: String(count).count - digits.count) + digits
}

private func order(_ openNumbers: [Int], moving number: Int, to placement: TaskPlacement) -> [Int]? {
    guard openNumbers.contains(number) else { return nil }
    let others = openNumbers.filter { $0 != number }
    switch placement {
    case .first:
        return [number] + others
    case let .after(anchor):
        guard let anchorIndex = others.firstIndex(of: anchor) else { return nil }
        return Array(others[...anchorIndex]) + [number] + Array(others[(anchorIndex + 1)...])
    }
}

public struct TaskBoard: Sendable, Equatable {
    private var tasksOfProject: [String: [Int: TaskRecord]] = [:]
    private var numbersOfProject: [String: [Int]] = [:]
    private var cursorOfProject: [String: Int] = [:]

    public init() {}

    public func tasks(projectIdentifier: String) -> [TaskRecord] {
        guard let held = tasksOfProject[projectIdentifier], let numbers = numbersOfProject[projectIdentifier] else { return [] }
        return numbers.compactMap { held[$0] }
    }

    public func task(projectIdentifier: String, number: Int) -> TaskRecord? {
        tasksOfProject[projectIdentifier]?[number]
    }

    public mutating func merge(projectIdentifier: String, tasks: [TaskRecord]) {
        tasks.forEach { replace(projectIdentifier: projectIdentifier, task: $0) }
    }

    public mutating func remove(projectIdentifier: String, numbers: [Int]) {
        guard !numbers.isEmpty else { return }
        numbers.forEach { tasksOfProject[projectIdentifier]?[$0] = nil }
        numbersOfProject[projectIdentifier]?.removeAll { numbers.contains($0) }
    }

    public mutating func replace(projectIdentifier: String, task: TaskRecord) {
        guard !isOlderThanTheHeldCopy(task, projectIdentifier: projectIdentifier) else { return }
        let isNewNumber = tasksOfProject[projectIdentifier]?[task.number] == nil
        tasksOfProject[projectIdentifier, default: [:]][task.number] = task
        guard isNewNumber else { return }
        insert(number: task.number, projectIdentifier: projectIdentifier)
    }

    private mutating func insert(number: Int, projectIdentifier: String) {
        if let lowerIndex = numbersOfProject[projectIdentifier]?.lastIndex(where: { $0 < number }) {
            numbersOfProject[projectIdentifier, default: []].insert(number, at: lowerIndex + 1)
            return
        }
        numbersOfProject[projectIdentifier, default: []].insert(number, at: 0)
    }

    private func isOlderThanTheHeldCopy(_ task: TaskRecord, projectIdentifier: String) -> Bool {
        guard let held = tasksOfProject[projectIdentifier]?[task.number] else { return false }
        return task.updatedAt < held.updatedAt
    }

    public mutating func reset(projectIdentifier: String) {
        tasksOfProject[projectIdentifier] = nil
        numbersOfProject[projectIdentifier] = nil
    }

    public func cursor(projectIdentifier: String) -> Int? {
        cursorOfProject[projectIdentifier]
    }

    public func setting(cursor: Int, projectIdentifier: String) -> TaskBoard {
        var board = self
        board.cursorOfProject[projectIdentifier] = cursor
        return board
    }

    func clearingCursor(projectIdentifier: String) -> TaskBoard {
        var board = self
        board.cursorOfProject[projectIdentifier] = nil
        return board
    }

    public func applying(_ outbox: Outbox) -> TaskBoard {
        let overlay = outbox.pendingChanges.reduce(into: Overlay(board: self, movedTasks: [])) { overlay, change in
            guard case let .field(key, .placement(placement)) = change else {
                let reopened = overlay.board.reopenedAfterAMove(change, movedTasks: overlay.movedTasks)
                overlay.board.apply(change)
                guard let reopened else { return }
                overlay.board.placeReopened(reopened, original: self, movedTasks: overlay.movedTasks)
                return
            }
            let openNumbers = overlay.board.openNumbers(projectIdentifier: key.projectIdentifier)
            guard let moved = order(openNumbers, moving: key.number, to: placement) else { return }
            overlay.board.giveDisplayOrderKeys(projectIdentifier: key.projectIdentifier, openNumbers: moved)
            overlay.movedTasks.insert(key)
        }
        let movedProjectIdentifiers = Set(overlay.movedTasks.map(\.projectIdentifier))
        return movedProjectIdentifiers.reduce(into: overlay.board) { board, projectIdentifier in
            board.giveDisplayOrderKeys(projectIdentifier: projectIdentifier, openNumbers: board.openNumbers(projectIdentifier: projectIdentifier))
            board.restoreDoneOrderKeys(projectIdentifier: projectIdentifier, from: self)
        }
    }

    private func openNumbers(projectIdentifier: String) -> [Int] {
        tasks(projectIdentifier: projectIdentifier)
            .filter { $0.state == .open }
            .sorted(by: PositionedTask.isEarlierInManualOrder)
            .map(\.number)
    }

    private mutating func apply(_ change: PendingChange) {
        switch change {
        case .add:
            return
        case let .field(key, patch):
            revise(key) { $0.applying(patch) }
        case let .state(key, .done, at):
            revise(key) { $0.setting(state: .done, completedAt: at) }
        case let .state(key, .open, _):
            revise(key) { $0.setting(state: .open, completedAt: nil) }
        }
    }

    private func reopenedAfterAMove(_ change: PendingChange, movedTasks: Set<TaskKey>) -> TaskKey? {
        guard case let .state(key, .open, _) = change else { return nil }
        let isProjectMoved = movedTasks.contains { $0.projectIdentifier == key.projectIdentifier }
        let isDoneUntilNow = task(projectIdentifier: key.projectIdentifier, number: key.number)?.state == .done
        guard isProjectMoved, isDoneUntilNow else { return nil }
        return key
    }

    private mutating func placeReopened(_ key: TaskKey, original: TaskBoard, movedTasks: Set<TaskKey>) {
        guard let reopened = original.task(projectIdentifier: key.projectIdentifier, number: key.number) else { return }
        let others = openNumbers(projectIdentifier: key.projectIdentifier).filter { $0 != key.number }
        let laterIndex = others.firstIndex { number in
            let isMoved = movedTasks.contains(TaskKey(projectIdentifier: key.projectIdentifier, number: number))
            guard !isMoved, let held = original.task(projectIdentifier: key.projectIdentifier, number: number) else { return false }
            return PositionedTask.isEarlierInManualOrder(reopened, held)
        }
        guard let laterIndex else {
            giveDisplayOrderKeys(projectIdentifier: key.projectIdentifier, openNumbers: others + [key.number])
            return
        }
        let placed = Array(others[..<laterIndex]) + [key.number] + Array(others[laterIndex...])
        giveDisplayOrderKeys(projectIdentifier: key.projectIdentifier, openNumbers: placed)
    }

    private mutating func giveDisplayOrderKeys(projectIdentifier: String, openNumbers: [Int]) {
        openNumbers.enumerated().forEach { position, number in
            let orderKey = displayOrderKey(position: position, count: openNumbers.count)
            revise(TaskKey(projectIdentifier: projectIdentifier, number: number)) { $0.setting(orderKey: orderKey) }
        }
    }

    private mutating func restoreDoneOrderKeys(projectIdentifier: String, from original: TaskBoard) {
        tasks(projectIdentifier: projectIdentifier)
            .filter { $0.state == .done }
            .compactMap { original.task(projectIdentifier: projectIdentifier, number: $0.number) }
            .forEach { held in
                revise(TaskKey(projectIdentifier: projectIdentifier, number: held.number)) { $0.setting(orderKey: held.orderKey) }
            }
    }

    private mutating func revise(_ key: TaskKey, change: (TaskRecord) -> TaskRecord) {
        guard let held = task(projectIdentifier: key.projectIdentifier, number: key.number) else { return }
        tasksOfProject[key.projectIdentifier]?[key.number] = change(held)
    }
}

private extension TaskRecord {
    func applying(_ patch: TaskPatch) -> TaskRecord {
        switch patch {
        case let .title(title):
            revised(title: title, notes: notes, dueDate: dueDate, state: state, orderKey: orderKey, completedAt: completedAt)
        case let .notes(notes):
            revised(title: title, notes: notes, dueDate: dueDate, state: state, orderKey: orderKey, completedAt: completedAt)
        case let .dueDate(dueDate):
            revised(title: title, notes: notes, dueDate: dueDate, state: state, orderKey: orderKey, completedAt: completedAt)
        case .placement:
            self
        }
    }

    func setting(state: TaskState, completedAt: Date?) -> TaskRecord {
        revised(title: title, notes: notes, dueDate: dueDate, state: state, orderKey: orderKey, completedAt: completedAt)
    }

    func setting(orderKey: String) -> TaskRecord {
        revised(title: title, notes: notes, dueDate: dueDate, state: state, orderKey: orderKey, completedAt: completedAt)
    }

    func revised(title: String, notes: String?, dueDate: CalendarDate?, state: TaskState, orderKey: String, completedAt: Date?) -> TaskRecord {
        TaskRecord(
            number: number,
            title: title,
            notes: notes,
            dueDate: dueDate,
            state: state,
            orderKey: orderKey,
            idempotencyKey: idempotencyKey,
            createdBy: createdBy,
            createdAt: createdAt,
            updatedAt: updatedAt,
            completedAt: completedAt
        )
    }
}
