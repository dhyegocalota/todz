public struct RibbonTask: Equatable, Sendable {
    public let number: Int?
    public let title: String

    public init(number: Int?, title: String) {
        self.number = number
        self.title = title
    }
}
