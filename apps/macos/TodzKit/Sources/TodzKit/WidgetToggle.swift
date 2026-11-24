import Foundation

public enum WidgetToggle {
    public static func setting(
        _ snapshot: WidgetSnapshot,
        projectIdentifier: String,
        number: Int,
        to state: TaskState,
        at instant: Date
    ) -> (snapshot: WidgetSnapshot, request: WidgetRequest)? {
        fatalError("WidgetToggle.setting is not implemented")
    }
}
