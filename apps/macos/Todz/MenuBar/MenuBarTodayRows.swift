import SwiftUI
import TodzKit

struct MenuBarTodayRows: View {
    let day: MenuBarDay
    let pendingTasks: [PendingTask]
    let focus: FocusState<MenuBarFocus?>.Binding
    let navigate: (MenuBarDirection) -> Void
    let maximumHeight: CGFloat
    @State private var contentHeight: CGFloat = .zero

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: .zero) {
                if day.screen == .allDone {
                    MenuBarAllDone()
                }
                if let upNext = day.upNext {
                    MenuBarUpNext(task: upNext, focus: focus, navigate: navigate)
                }
                ForEach(day.queue, id: \.key) { task in
                    MenuBarRow(task: task, isUpNext: false, focus: focus, navigate: navigate)
                }
                ForEach(pendingTasks, id: \.idempotencyKey) { pendingTask in
                    PendingTaskRow(task: pendingTask, item: .today)
                        .padding(.horizontal)
                }
                if showsDoneToday {
                    MenuBarDoneToday(tasks: day.doneToday, focus: focus, navigate: navigate)
                }
            }
            .padding(.vertical)
            .onGeometryChange(for: CGFloat.self, of: \.size.height) { contentHeight = $0 }
        }
        .frame(height: min(contentHeight, maximumHeight))
    }

    private var showsDoneToday: Bool {
        day.screen != .closingDay && !day.doneToday.isEmpty
    }
}
