public struct RibbonPresentation: Equatable, Sendable {
    public let content: RibbonContent
    public let frame: RibbonFrame
    public let textWidth: Double

    public init(content: RibbonContent, frame: RibbonFrame, textWidth: Double) {
        self.content = content
        self.frame = frame
        self.textWidth = textWidth
    }
}
