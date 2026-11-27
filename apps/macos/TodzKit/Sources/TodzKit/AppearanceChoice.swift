import AppKit

public enum AppearanceChoice: String, CaseIterable, Sendable {
    case system
    case light
    case dark

    public var appearanceName: NSAppearance.Name? {
        switch self {
        case .system: nil
        case .light: .aqua
        case .dark: .darkAqua
        }
    }
}
