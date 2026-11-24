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
        case let .failed(failure):
            VStack(alignment: .leading) {
                failureLine(failure)
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

    @ViewBuilder private func failureLine(_ failure: HistoryFailure) -> some View {
        switch failure {
        case .offline:
            Text(InspectorCopy.historyOffline)
                .foregroundStyle(.secondary)
        case .failed:
            Text(InspectorCopy.historyFailed)
                .foregroundStyle(.red)
        }
    }
}
