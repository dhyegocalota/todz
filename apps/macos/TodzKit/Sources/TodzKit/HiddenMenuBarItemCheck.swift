import CoreGraphics

@MainActor public final class HiddenMenuBarItemCheck {
    public static let settlingPause = Duration.seconds(2)

    private let gate: ProactiveGate
    private let isDeclined: () -> Bool
    private let pause: (Duration) async throws -> Void
    private let itemFrame: () -> CGRect?
    private let screenFrames: () -> [CGRect]
    private let offer: () -> Void
    private var isOffered = false
    private var isWaiting = false

    public init(
        gate: ProactiveGate,
        isDeclined: @escaping () -> Bool,
        pause: @escaping (Duration) async throws -> Void,
        itemFrame: @escaping () -> CGRect?,
        screenFrames: @escaping () -> [CGRect],
        offer: @escaping () -> Void
    ) {
        self.gate = gate
        self.isDeclined = isDeclined
        self.pause = pause
        self.itemFrame = itemFrame
        self.screenFrames = screenFrames
        self.offer = offer
    }

    public func run() async {
        let isSilent = isOffered || isWaiting || isDeclined() || gate.isQuiet
        guard !isSilent else { return }
        isWaiting = true
        defer { isWaiting = false }
        do {
            try await pause(Self.settlingPause)
        } catch {
            return
        }
        guard !gate.isQuiet, let frame = itemFrame() else { return }
        guard !MenuBarItemPlacement.isOnTheBar(itemFrame: frame, screenFrames: screenFrames()) else { return }
        isOffered = true
        offer()
    }
}
