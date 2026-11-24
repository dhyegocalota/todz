import Foundation
@testable import TodzKit

let fixedInstant = Date(timeIntervalSince1970: 1_795_532_400)

struct MutableTask {
    var number: Int
    var title: String
    var notes: String?
    var dueDate: CalendarDate?
    var state: TaskState
    var orderKey: String
    var idempotencyKey: String?
    var createdBy: ChangeActor
    var createdAt: Date
    var updatedAt: Date
    var completedAt: Date?

    init(
        number: Int,
        title: String = "A task",
        dueDate: CalendarDate? = nil,
        state: TaskState = .open,
        orderKey: String = "a0",
        updatedAt: Date = fixedInstant,
        completedAt: Date? = nil
    ) {
        self.number = number
        self.title = title
        self.notes = nil
        self.dueDate = dueDate
        self.state = state
        self.orderKey = orderKey
        self.idempotencyKey = nil
        self.createdBy = ChangeActor(kind: .owner, clientName: nil)
        self.createdAt = fixedInstant
        self.updatedAt = updatedAt
        self.completedAt = completedAt
    }

    init(_ task: TaskRecord) {
        number = task.number
        title = task.title
        notes = task.notes
        dueDate = task.dueDate
        state = task.state
        orderKey = task.orderKey
        idempotencyKey = task.idempotencyKey
        createdBy = task.createdBy
        createdAt = task.createdAt
        updatedAt = task.updatedAt
        completedAt = task.completedAt
    }

    var record: TaskRecord {
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
