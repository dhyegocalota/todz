public enum MotionTreatment: Sendable, Equatable {
    case animate
    case crossfade
    case instant
}

public enum MotionTransform: Sendable, Equatable {
    case none
    case scale(Double)
    case offset(vertical: Double)

    public var scale: Double {
        guard case let .scale(factor) = self else { return 1 }
        return factor
    }
}

private let instantUnderReduceMotion: Set<MotionMoment> = [.reorder, .press, .hover, .focus]

private struct RestingMotion {
    let token: MotionToken
    let transform: MotionTransform

    init(_ token: MotionToken, _ transform: MotionTransform = .none) {
        self.token = token
        self.transform = transform
    }
}

private func resting(_ moment: MotionMoment) -> RestingMotion {
    switch moment {
    case .listInsert: RestingMotion(.bloom, .scale(MotionBloom.dimmedScale))
    case .listRemove: RestingMotion(.snap)
    case .complete: RestingMotion(.draw)
    case .uncomplete: RestingMotion(.draw)
    case .reorder: RestingMotion(.settle)
    case .workspaceSwitch: RestingMotion(.snap)
    case .popoverOpen: RestingMotion(.bloom, .scale(MotionBloom.dimmedScale))
    case .sheetPresent: RestingMotion(.snap)
    case .busySwap: RestingMotion(.snap)
    case .stageChange: RestingMotion(.settle)
    case .disclosure: RestingMotion(.settle)
    case .countChange: RestingMotion(.snap)
    case .ringFill: RestingMotion(.settle)
    case .upNextSwap: RestingMotion(.settle, .offset(vertical: 8))
    case .banner: RestingMotion(.snap, .offset(vertical: 6))
    case .skeletonToRows: RestingMotion(.crossfade)
    case .press: RestingMotion(.press, .scale(0.97))
    case .hover: RestingMotion(.snap)
    case .focus: RestingMotion(.snap)
    }
}

public struct MotionSpec: Equatable, Sendable {
    public let treatment: MotionTreatment
    public let token: MotionToken?
    public let transform: MotionTransform
    public let delayMilliseconds: Int

    // NB ADR 0114: under Reduce Motion a moment is a 150 ms crossfade or an instant change, and none scales, offsets or staggers.
    public static func of(_ moment: MotionMoment, isReduceMotionOn: Bool, index: Int) -> MotionSpec {
        guard !isReduceMotionOn else { return reduced(moment) }
        let motion = resting(moment)
        let isStaggered = moment == .workspaceSwitch
        let treatment: MotionTreatment = motion.token == .crossfade ? .crossfade : .animate
        return MotionSpec(
            treatment: treatment,
            token: motion.token,
            transform: motion.transform,
            delayMilliseconds: isStaggered ? MotionStagger.delayMilliseconds(index: index, token: motion.token) : 0
        )
    }

    private static func reduced(_ moment: MotionMoment) -> MotionSpec {
        guard !instantUnderReduceMotion.contains(moment) else {
            return MotionSpec(treatment: .instant, token: nil, transform: .none, delayMilliseconds: 0)
        }
        return MotionSpec(treatment: .crossfade, token: .crossfade, transform: .none, delayMilliseconds: 0)
    }
}
