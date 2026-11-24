struct PositionedTask {
    let position: Int
    let boardTask: BoardTask

    var task: TaskRecord {
        boardTask.task
    }

    private var orderKey: ByteOrderKey {
        ByteOrderKey(task.orderKey)
    }

    static func isEarlierInManualOrder(_ lhs: PositionedTask, _ rhs: PositionedTask) -> Bool {
        (lhs.orderKey, lhs.task.number) < (rhs.orderKey, rhs.task.number)
    }

    static func isEarlierInSidebarOrder(_ lhs: PositionedTask, _ rhs: PositionedTask) -> Bool {
        (lhs.position, lhs.orderKey, lhs.task.number) < (rhs.position, rhs.orderKey, rhs.task.number)
    }

    static func isEarlierInSidebarByNumber(_ lhs: PositionedTask, _ rhs: PositionedTask) -> Bool {
        (lhs.position, lhs.task.number) < (rhs.position, rhs.task.number)
    }
}
