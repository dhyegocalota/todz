import SwiftUI
import TodzKit

private let spokenSeparator = ", "

struct WidgetTaskRow: View {
    let task: WidgetSnapshotTask
    let key: TaskKey
    let showsTag: Bool
    let widgetDay: WidgetDay

    var body: some View {
        HStack {
            WidgetCheckbox(task: task, key: key)
                .widgetAccentable(task.isDone)
            Link(destination: WidgetLink.task(key).url(scheme: WidgetLinkConfiguration.linkScheme)) {
                HStack {
                    Text(task.title)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .strikethrough(task.isDone)
                        .foregroundStyle(task.isDone ? Color.secondary : Color.primary)
                    Spacer()
                    if let overdueText {
                        Text(overdueText)
                            .font(.subheadline)
                            .foregroundStyle(.red)
                    }
                    if let tagText {
                        Text(tagText)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .background(.fill.quaternary)
                    }
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(task.title)
            .accessibilityValue(accessibilityValue)
            .accessibilityHint(AccessibilityCopy.rowOpensWindow)
        }
    }

    private var overdueText: String? {
        let showsOverdue = !task.isDone && task.isOverdue
        guard showsOverdue else { return nil }
        return widgetDay.dueText(of: task)
    }

    private var tagText: String? {
        let showsProjectTag = showsTag && !task.isDone && overdueText == nil
        guard showsProjectTag else { return nil }
        return task.projectName
    }

    private var accessibilityValue: String {
        let state = task.isDone ? AccessibilityCopy.rowValueDone : AccessibilityCopy.rowValueOpen
        return [state, overdueText, tagText].compactMap(\.self).joined(separator: spokenSeparator)
    }
}
