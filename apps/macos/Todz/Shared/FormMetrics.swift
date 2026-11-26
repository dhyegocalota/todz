import SwiftUI

// NB ADR 0104: the form metrics are these four values and nothing else.
enum FormMetrics {
    static let fieldCornerRadius: CGFloat = 8
    static let panelCornerRadius: CGFloat = 18
    static let fieldHorizontalPadding: CGFloat = 10
    static let fieldVerticalPadding: CGFloat = 7
    static let restRingWidth: CGFloat = 1
    static let focusRingWidth: CGFloat = 2
    static let increasedContrastRingWidth: CGFloat = 1
    static let sheetMinimumWidth: CGFloat = 320
    static let disabledOpacity: Double = 0.5
    static let enabledOpacity: Double = 1
}
