private let smallRowCount = 0
private let mediumRowCount = 3
private let largeRowCount = 7

public enum WidgetFamilyKind: Sendable, CaseIterable {
    case small
    case medium
    case large

    var rowCount: Int {
        switch self {
        case .small: smallRowCount
        case .medium: mediumRowCount
        case .large: largeRowCount
        }
    }
}
