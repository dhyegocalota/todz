import SwiftUI
import TodzKit

private let expandedSymbol = "chevron.down"
private let collapsedSymbol = "chevron.right"

struct ServerDisclosure: View {
    @Binding var isExpanded: Bool
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reducesMotion
    @AccessibilityFocusState private var isLineFocused: Bool

    var body: some View {
        VStack {
            Button(action: toggle) {
                HStack {
                    Text(SignInCopy.serverDisclosure(server: ServerName.of(address: model.serverURL)))
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Image(systemName: isExpanded ? expandedSymbol : collapsedSymbol)
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .help(model.serverURL.origin)
            .accessibilityValue(isExpanded ? AccessibilityCopy.disclosureExpanded : AccessibilityCopy.disclosureCollapsed)
            .accessibilityHint(SignInCopy.serverDisclosureHint)
            .accessibilityFocused($isLineFocused)
            if isExpanded {
                ServerAddressForm(layout: .column, exit: collapse)
            }
            if isExpanded || model.isUpdateNeeded {
                VersionLine()
            }
        }
        .onChange(of: model.serverURL) { isExpanded = false }
    }

    private func toggle() {
        withAnimation(reducesMotion ? nil : .default) { isExpanded.toggle() }
    }

    private func collapse() {
        withAnimation(reducesMotion ? nil : .default) { isExpanded = false }
        isLineFocused = true
    }
}
