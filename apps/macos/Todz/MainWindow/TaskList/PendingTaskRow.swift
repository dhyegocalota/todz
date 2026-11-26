import SwiftUI
import TodzKit

private let pendingSymbol = "circle.dashed"

struct PendingTaskRow: View {
    let task: PendingTask
    let item: SidebarItem
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Image(systemName: pendingSymbol)
                .foregroundStyle(.secondary)
            VStack(alignment: .leading) {
                TaskRowTitle(title: task.title, isDone: false)
                if !details.isEmpty {
                    TaskRowSubline(details: details)
                }
            }
            Spacer()
        }
        .help(TaskRowCopy.pendingHelp)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(task.title)
        .accessibilityValue(details.spokenValue(state: TaskRowCopy.pending, today: model.today, timeZone: model.timeZone))
    }

    private var details: TaskRowDetails {
        let project = model.shownWorkspaces.flatMap(\.projects).first { $0.identifier == task.projectIdentifier }
        return TaskRowDetails(pendingTask: task, projectName: project?.name, workspaceName: model.taggedWorkspaceName[task.projectIdentifier], item: item, today: model.today)
    }
}
