public struct AddFieldArming: Equatable, Sendable {
    public enum Event: Sendable {
        case addFieldClicked
        case newTaskCommand
    }

    public private(set) var isArmed: Bool

    public init(opening: OpeningFocus) {
        isArmed = true
    }

    public mutating func apply(_ event: Event) {}
}
