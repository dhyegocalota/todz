import SwiftUI
import TodzKit

private let compatibleSymbol = "checkmark.circle.fill"
private let updateNeededSymbol = "arrow.down.circle"
private let behindSymbol = "info.circle"
private let versionLineLimit = 2

struct VersionLine: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let compatibility = model.compatibility
        HStack(alignment: .firstTextBaseline) {
            symbol(of: compatibility)
            Text(VersionCopy.line(compatibility))
                .lineLimit(versionLineLimit)
                .help(VersionCopy.tooltip(compatibility))
                .accessibilityLabel(VersionCopy.accessibilityLabel(compatibility))
            if model.isUpdateNeeded {
                DownloadButton()
                    .buttonStyle(.link)
            }
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
        .accessibilityElement(children: .contain)
        .onAppear { model.refreshCompatibility() }
    }

    @ViewBuilder
    private func symbol(of compatibility: VersionCompatibility) -> some View {
        switch compatibility {
        case .compatible:
            Image(systemName: compatibleSymbol)
                .foregroundStyle(.green)
                .accessibilityHidden(true)
        case .updateNeeded:
            Image(systemName: updateNeededSymbol)
                .foregroundStyle(Color.accentColor)
                .accessibilityHidden(true)
        case .serverBehind:
            Image(systemName: behindSymbol)
                .accessibilityHidden(true)
        case .serverUnknown:
            EmptyView()
        }
    }
}
