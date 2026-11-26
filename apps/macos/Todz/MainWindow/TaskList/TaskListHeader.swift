import SwiftUI
import TodzKit

struct TaskListHeader: View {
    let workspace: Workspace
    let item: SidebarItem
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            if let title = item.title(in: workspace) {
                Text(title)
                    .font(.title)
                    .bold()
                    .lineLimit(1)
                    .titleFlightDestination(item: item)
            }
            Spacer()
            if item == .today {
                Text(DayFormat.full(day: model.today, timeZone: model.timeZone))
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }
}
