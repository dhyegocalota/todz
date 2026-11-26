public struct CountRollPresentation: Equatable, Sendable {
    public let outgoing: String
    public let incoming: String
    public let frame: CountRollFrame

    public init(outgoing: String, incoming: String, frame: CountRollFrame) {
        self.outgoing = outgoing
        self.incoming = incoming
        self.frame = frame
    }
}
