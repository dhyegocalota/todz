import Observation

@MainActor @Observable public final class CountRollCoordinator {
    public private(set) var presentation: CountRollPresentation?
    @ObservationIgnored var running: Task<Void, Never>?
    @ObservationIgnored private let pause: (Duration) async throws -> Void
    @ObservationIgnored private let isMotionReduced: () -> Bool

    public init(pause: @escaping (Duration) async throws -> Void, isMotionReduced: @escaping () -> Bool) {
        self.pause = pause
        self.isMotionReduced = isMotionReduced
    }

    public func roll(from previous: String?, to next: String?) {
        end()
        guard CountRoll.isRolling(from: previous, to: next), let previous, let next else { return }
        let frames = CountRoll.frames(isMotionReduced: isMotionReduced())
        running = Task { [weak self] in
            await self?.play(frames, outgoing: previous, incoming: next)
        }
    }

    public func end() {
        running?.cancel()
        running = nil
        presentation = nil
    }

    private func play(_ frames: [CountRollFrame], outgoing: String, incoming: String) async {
        for frame in frames {
            presentation = CountRollPresentation(outgoing: outgoing, incoming: incoming, frame: frame)
            do {
                try await pause(frame.duration)
                try Task.checkCancellation()
            } catch {
                return
            }
        }
        presentation = nil
        running = nil
    }
}
