import SwiftUI
import TodzKit

private let overdueSymbol = "exclamationmark.circle.fill"
private let tagSeparator = " · "
private let spokenSeparator = ", "

struct MenuBarRowMetaLine: View {
    let meta: MenuBarRowMeta
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack {
            if let tag = meta.tag {
                Text(tag)
            }
            if let overdue = meta.overdue {
                Label(DueLabel.text(dueDate: overdue, today: model.today, timeZone: model.timeZone), systemImage: overdueSymbol)
                    .foregroundStyle(.red)
                    .layoutPriority(1)
            }
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .truncationMode(.tail)
    }
}

extension MenuBarRowMeta {
    var tag: String? {
        let parts = [workspaceName, projectName].compactMap(\.self)
        guard !parts.isEmpty else { return nil }
        return parts.joined(separator: tagSeparator)
    }

    @MainActor func spokenValue(state: String, today: CalendarDate, timeZone: TimeZone) -> String {
        let overdueText = overdue.map { DueLabel.text(dueDate: $0, today: today, timeZone: timeZone) }
        let agentLine = agentName.map { TaskRowCopy.via(client: $0) }
        return [state, tag, overdueText, agentLine].compactMap(\.self).joined(separator: spokenSeparator)
    }
}
