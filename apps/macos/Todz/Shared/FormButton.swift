import SwiftUI
import TodzKit

private let shownOpacity: Double = 1
private let hiddenOpacity: Double = 0

enum FormActionKind {
    case primary
    case secondary
    case cancel
    case destructive
    case quiet
}

struct FormButton: View {
    let title: String
    let busyTitle: String?
    let kind: FormActionKind
    let isBusy: Bool
    let disabledReason: String?
    var isFullWidth = false
    let action: () -> Void

    var body: some View {
        styledButton
            .disabled(because: disabledReason)
            .disabled(isBusy)
            .accessibilityLabel(accessibleTitle)
    }

    private var button: some View {
        Button(role: role, action: action) {
            label
        }
    }

    @ViewBuilder private var styledButton: some View {
        switch kind {
        case .primary: button.buttonStyle(.borderedProminent)
        case .secondary, .cancel: button.buttonStyle(.bordered)
        case .destructive: button.buttonStyle(.borderedProminent).tint(.red)
        case .quiet: button.buttonStyle(.link)
        }
    }

    private var role: ButtonRole? {
        switch kind {
        case .cancel: .cancel
        case .destructive: .destructive
        case .primary, .secondary, .quiet: nil
        }
    }

    private var label: some View {
        ZStack {
            Text(title)
                .opacity(isBusy ? hiddenOpacity : shownOpacity)
            if let busyTitle {
                HStack {
                    ProgressView()
                        .controlSize(.small)
                    Text(busyTitle)
                }
                .opacity(isBusy ? shownOpacity : hiddenOpacity)
            }
        }
        .frame(maxWidth: isFullWidth ? .infinity : nil)
        .todzMotion(.busySwap, value: isBusy)
    }

    private var accessibleTitle: String {
        guard isBusy, let busyTitle else { return title }
        return busyTitle
    }
}
