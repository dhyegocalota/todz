public struct RibbonFrame: Equatable, Sendable {
    public let reveal: Double
    public let offset: Double
    public let duration: Duration

    public init(reveal: Double, offset: Double, duration: Duration) {
        self.reveal = reveal
        self.offset = offset
        self.duration = duration
    }
}
