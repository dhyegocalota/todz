import SwiftUI
import TodzKit

struct FieldChrome: ViewModifier {
    let state: FieldState
    @ScaledMetric(relativeTo: .body) private var horizontalPadding = FormMetrics.fieldHorizontalPadding
    @ScaledMetric(relativeTo: .body) private var verticalPadding = FormMetrics.fieldVerticalPadding
    @Environment(\.colorSchemeContrast) private var contrast

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, horizontalPadding)
            .padding(.vertical, verticalPadding)
            .background(.fill.quaternary, in: shape)
            .overlay { shape.strokeBorder(ringColor, lineWidth: ringWidth) }
            .opacity(state == .disabled ? FormMetrics.disabledOpacity : FormMetrics.enabledOpacity)
            .todzAnimation(.snap, value: state)
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: FormMetrics.fieldCornerRadius, style: .continuous)
    }

    private var isIncreasedContrast: Bool {
        contrast == .increased
    }

    private var ringColor: Color {
        switch state {
        case .rest, .disabled: isIncreasedContrast ? Color.secondary : Color(nsColor: .separatorColor)
        case .focused: Color.accentColor
        case .invalid: Color.red
        case .busy: Color.accentColor.opacity(FormMetrics.disabledOpacity)
        }
    }

    private var ringWidth: CGFloat {
        let baseWidth = switch state {
        case .rest, .disabled, .busy: FormMetrics.restRingWidth
        case .focused, .invalid: FormMetrics.focusRingWidth
        }
        guard isIncreasedContrast else { return baseWidth }
        return baseWidth + FormMetrics.increasedContrastRingWidth
    }
}
