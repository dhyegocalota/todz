public enum WidgetContent: Equatable, Sendable {
    case prompt
    case empty(workspaceName: String)
    case today(WidgetToday)

    // NB ADR 0032: a snapshot of another day shows the prompt, so a widget never checks off yesterday's list.
    public static func of(snapshot: WidgetSnapshot?, family: WidgetFamilyKind, on day: CalendarDate) -> WidgetContent {
        guard let snapshot, snapshot.isCurrent(on: day) else { return .prompt }
        let rows = snapshot.open + snapshot.pending + snapshot.doneToday
        guard !rows.isEmpty else { return .empty(workspaceName: snapshot.workspaceName) }
        let confirmed = snapshot.open + snapshot.doneToday
        let widgetToday = WidgetToday(
            workspaceName: snapshot.workspaceName,
            rows: Array(rows.prefix(family.rowCount)),
            nextUp: rows.first { $0.state == .open },
            openCount: confirmed.filter { $0.state == .open }.count,
            doneCount: confirmed.filter { $0.state == .done }.count
        )
        return .today(widgetToday)
    }
}
