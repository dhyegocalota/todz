public enum RibbonTrigger {
    public static func isAgentChange(previous: TaskRecord?, arrived: TaskRecord, today: CalendarDate) -> Bool {
        guard let previous else { return isNewAgentTaskOfToday(arrived, today: today) }
        return isOpenInToday(previous, today: today) && arrived.state == .done
    }

    private static func isNewAgentTaskOfToday(_ task: TaskRecord, today: CalendarDate) -> Bool {
        guard case .agent = task.createdBy else { return false }
        return isOpenInToday(task, today: today)
    }

    private static func isOpenInToday(_ task: TaskRecord, today: CalendarDate) -> Bool {
        guard task.state == .open, let dueDate = task.dueDate else { return false }
        return dueDate <= today
    }
}
