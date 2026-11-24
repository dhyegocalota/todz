import SwiftUI
import TodzKit

struct MenuBarTodayRows: View {
    let sections: [TaskSection]
    let maximumHeight: CGFloat
    @State private var contentHeight: CGFloat = .zero

    var body: some View {
        ScrollView {
            VStack(alignment: .leading) {
                ForEach(sections) { section in
                    ForEach(section.tasks, id: \.key) { task in
                        MenuBarRow(task: task)
                    }
                    ForEach(section.pendingTasks, id: \.idempotencyKey) { pendingTask in
                        PendingTaskRow(task: pendingTask, item: .today)
                            .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
            .onGeometryChange(for: CGFloat.self, of: \.size.height) { contentHeight = $0 }
        }
        .frame(height: min(contentHeight, maximumHeight))
    }
}
