public struct RibbonPresentation: Equatable, Sendable {
    public let content: RibbonContent
    public let frame: RibbonFrame
    public let textWidth: Double
    public let isMotionReduced: Bool

    public init(content: RibbonContent, frame: RibbonFrame, textWidth: Double, isMotionReduced: Bool) {
        self.content = content
        self.frame = frame
        self.textWidth = textWidth
        self.isMotionReduced = isMotionReduced
    }
}
