public enum WidgetContent: Equatable, Sendable {
    case prompt
    case empty(workspaceName: String)
    case today(WidgetToday)

    public static func of(snapshot: WidgetSnapshot?, family: WidgetFamilyKind, on day: CalendarDate) -> WidgetContent {
        fatalError("WidgetContent.of is not implemented")
    }
}
