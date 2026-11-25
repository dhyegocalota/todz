import TodzKit

enum MainWindowFocus: Hashable {
    case addField
    case list
    case inspectorTitle

    init(_ openingFocus: OpeningFocus) {
        switch openingFocus {
        case .addField: self = .addField
        case .list: self = .list
        }
    }
}
