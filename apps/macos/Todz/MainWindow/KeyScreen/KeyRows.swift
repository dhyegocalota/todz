import SwiftUI
import TodzKit

struct KeyRows: View {
    let projectName: String
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reducesMotion

    var body: some View {
        switch model.keys {
        case .none, .loading:
            HStack {
                ProgressView()
                    .controlSize(.small)
                Text(MainWindowCopy.loading)
            }
        case .failed:
            failure
        case let .loaded(keys):
            VStack(alignment: .leading) {
                if model.keyReloadFailure != nil {
                    failure
                }
                if keys.isEmpty {
                    Text(KeyScreenCopy.noKeys)
                        .foregroundStyle(.secondary)
                }
                ForEach(Array(newestFirst(keys).enumerated()), id: \.element.identifier) { index, key in
                    if index > 0 {
                        Divider()
                    }
                    KeyRow(key: key, projectName: projectName)
                }
            }
            .animation(reducesMotion ? nil : .default, value: keys)
        }
    }

    private var failure: some View {
        VStack(alignment: .leading) {
            ValidationLine(text: KeyScreenCopy.listFailed, tone: .issue)
            Button(MainWindowCopy.tryAgain) {
                Task { await model.loadKeys() }
            }
        }
    }

    private func newestFirst(_ keys: [ProjectKey]) -> [ProjectKey] {
        keys.sorted { $0.createdAt > $1.createdAt }
    }
}
