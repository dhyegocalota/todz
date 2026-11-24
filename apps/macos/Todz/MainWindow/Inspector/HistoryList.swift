import SwiftUI
import TodzKit

struct HistoryList: View {
    let task: BoardTask
    @Environment(AppModel.self) private var model

    var body: some View {
        switch model.histories[task.key] {
        case .none, .loading:
            ProgressView()
                .controlSize(.small)
        case .failed:
            VStack(alignment: .leading) {
                Text(InspectorCopy.historyFailed)
                    .foregroundStyle(.red)
                Button(MainWindowCopy.tryAgain) {
                    Task { await model.loadHistory(task: task.key) }
                }
            }
        case let .loaded(entries):
            VStack(alignment: .leading) {
                ForEach(Array(entries.reversed().enumerated()), id: \.offset) { _, entry in
                    HistoryLine(entry: entry)
                }
            }
        }
    }
}
