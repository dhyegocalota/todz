public struct CountRollFrame: Equatable, Sendable {
    public let outgoingRise: Double
    public let outgoingOpacity: Double
    public let incomingRise: Double
    public let incomingOpacity: Double
    public let duration: Duration

    public init(outgoingRise: Double, outgoingOpacity: Double, incomingRise: Double, incomingOpacity: Double, duration: Duration) {
        self.outgoingRise = outgoingRise
        self.outgoingOpacity = outgoingOpacity
        self.incomingRise = incomingRise
        self.incomingOpacity = incomingOpacity
        self.duration = duration
    }
}
