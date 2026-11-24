import AppIntents
import Foundation
import TodzKit

struct ToggleTaskIntent: AppIntent {
    static let title: LocalizedStringResource = "Check Off a Task"
    static let isDiscoverable = false

    @Parameter(title: "Project") var projectIdentifier: String
    @Parameter(title: "Number") var number: Int
    @Parameter(title: "Done") var isDone: Bool

    init() {}

    init(key: TaskKey, state: TaskState) {
        projectIdentifier = key.projectIdentifier
        number = key.number
        isDone = state == .done
    }

    // NB ADR 0033: a checkbox redraws the snapshot, then writes its request beside it, then tells the running app with a Darwin notification.
    func perform() async throws -> some IntentResult {
        guard let store = FileWidgetStore.shared, let snapshot = try store.readSnapshot() else { return .result() }
        let state: TaskState = isDone ? .done : .open
        let toggled = WidgetToggle.setting(snapshot, projectIdentifier: projectIdentifier, number: number, to: state, at: .now)
        guard let toggled else { return .result() }
        try store.writeSnapshot(toggled.snapshot)
        try store.addRequest(toggled.request)
        let name = CFNotificationName(WidgetNotification.requestsAdded as CFString)
        CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(), name, nil, nil, true)
        return .result()
    }
}
