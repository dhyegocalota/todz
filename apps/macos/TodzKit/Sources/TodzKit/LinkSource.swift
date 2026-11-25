public enum LinkSource: Sendable, CaseIterable {
    case widget
    case morningGlance

    public var openingFocus: OpeningFocus {
        .addField
    }
}

public enum OpeningFocus: Sendable {
    case addField
    case list
}
