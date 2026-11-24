extension TaskViews {
    public var upcomingSchedule: [UpcomingDay] {
        let confirmedDays = upcomingDays
        let pendingDays = upcomingPendingDays
        let days = Set(confirmedDays.map(\.day) + pendingDays.map(\.day)).sorted()
        return days.map { day in
            UpcomingDay(
                day: day,
                tasks: confirmedDays.filter { $0.day == day }.flatMap(\.tasks),
                pendingTasks: pendingDays.filter { $0.day == day }.flatMap(\.tasks)
            )
        }
    }
}
