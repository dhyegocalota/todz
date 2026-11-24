import SwiftUI
import TodzKit

struct TaskListHeader: View {
    let workspace: Workspace
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            if let title = model.selectedItem.title(in: workspace) {
                Text(title)
                    .font(.title)
                    .bold()
                    .lineLimit(1)
            }
            Spacer()
            if model.selectedItem == .today {
                Text(DayFormat.full(day: model.today, timeZone: model.timeZone))
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }
}
