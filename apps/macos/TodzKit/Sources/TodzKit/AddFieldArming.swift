public struct AddFieldArming: Equatable, Sendable {
    public enum Event: Sendable {
        case addFieldClicked
        case newTaskCommand
    }

    public private(set) var isArmed: Bool

    public init(opening: OpeningFocus) {
        isArmed = opening == .addField
    }

    public mutating func apply(_ event: Event) {
        isArmed = true
    }
}
