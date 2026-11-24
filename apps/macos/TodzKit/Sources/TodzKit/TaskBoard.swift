import Foundation

private let keyPaddingDigit: Character = "0"

private typealias Overlay = (board: TaskBoard, movedProjectIdentifiers: Set<String>)

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
    private var cursorOfProject: [String: Int] = [:]

    public init() {}

    public func tasks(projectIdentifier: String) -> [TaskRecord] {
        guard let held = tasksOfProject[projectIdentifier] else { return [] }
        return held.values.sorted { $0.number < $1.number }
    }

    public func task(projectIdentifier: String, number: Int) -> TaskRecord? {
        tasksOfProject[projectIdentifier]?[number]
    }

    public mutating func merge(projectIdentifier: String, tasks: [TaskRecord]) {
        tasks.forEach { replace(projectIdentifier: projectIdentifier, task: $0) }
    }

    public mutating func replace(projectIdentifier: String, task: TaskRecord) {
        guard !isOlderThanTheHeldCopy(task, projectIdentifier: projectIdentifier) else { return }
        tasksOfProject[projectIdentifier, default: [:]][task.number] = task
    }

    private func isOlderThanTheHeldCopy(_ task: TaskRecord, projectIdentifier: String) -> Bool {
        guard let held = tasksOfProject[projectIdentifier]?[task.number] else { return false }
        return task.updatedAt < held.updatedAt
    }

    public mutating func reset(projectIdentifier: String) {
        tasksOfProject[projectIdentifier] = nil
    }

    public func cursor(projectIdentifier: String) -> Int? {
        cursorOfProject[projectIdentifier]
    }

    public func setting(cursor: Int, projectIdentifier: String) -> TaskBoard {
        var board = self
        board.cursorOfProject[projectIdentifier] = cursor
        return board
    }

    public func applying(_ outbox: Outbox) -> TaskBoard {
        let overlay = outbox.pendingChanges.reduce(into: Overlay(board: self, movedProjectIdentifiers: [])) { overlay, change in
            guard case let .field(key, .placement(placement)) = change else {
                overlay.board.apply(change)
                return
            }
            let openNumbers = overlay.board.openNumbers(projectIdentifier: key.projectIdentifier)
            guard let moved = order(openNumbers, moving: key.number, to: placement) else { return }
            overlay.board.giveDisplayOrderKeys(projectIdentifier: key.projectIdentifier, openNumbers: moved)
            overlay.movedProjectIdentifiers.insert(key.projectIdentifier)
        }
        return overlay.movedProjectIdentifiers.reduce(into: overlay.board) { board, projectIdentifier in
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
