import SwiftUI

private let dimmedScale = 0.96
private let insertedScale = 0.92

private enum BloomPhase: CaseIterable {
    case dimmed
    case lit

    var scale: Double {
        switch self {
        case .dimmed: dimmedScale
        case .lit: 1
        }
    }

    var opacity: Double {
        switch self {
        case .dimmed: 0
        case .lit: 1
        }
    }
}

private struct TodzAnimationModifier<Value: Equatable>: ViewModifier {
    let token: MotionToken
    let value: Value
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn

    func body(content: Content) -> some View {
        content.animation(MotionRule.token(token, isReduceMotionOn: isReduceMotionOn).animation, value: value)
    }
}

private struct TodzCountTransitionModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn

    func body(content: Content) -> some View {
        content.contentTransition(isCrossfaded ? .opacity : .numericText())
    }

    private var isCrossfaded: Bool {
        MotionRule.token(.snap, isReduceMotionOn: isReduceMotionOn) == .crossfade
    }
}

private struct TodzBloomModifier: ViewModifier {
    let trigger: Int
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn

    func body(content: Content) -> some View {
        content.phaseAnimator(BloomPhase.allCases, trigger: trigger) { view, phase in
            view
                .scaleEffect(isReduceMotionOn ? 1 : phase.scale)
                .opacity(phase.opacity)
        } animation: { _ in
            MotionRule.token(.bloom, isReduceMotionOn: isReduceMotionOn).animation
        }
    }
}

private struct TodzEntranceModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn
    @State private var isPresented = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPresented || isReduceMotionOn ? 1 : dimmedScale)
            .opacity(isPresented ? 1 : 0)
            .animation(MotionRule.token(.bloom, isReduceMotionOn: isReduceMotionOn).animation, value: isPresented)
            .onAppear { isPresented = true }
    }
}

private struct TodzInsertionModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn

    func body(content: Content) -> some View {
        content.transition(isCrossfaded ? .opacity : .opacity.combined(with: .scale(scale: insertedScale)))
    }

    private var isCrossfaded: Bool {
        MotionRule.token(.settle, isReduceMotionOn: isReduceMotionOn) == .crossfade
    }
}

extension View {
    public func todzAnimation(_ token: MotionToken, value: some Equatable) -> some View {
        modifier(TodzAnimationModifier(token: token, value: value))
    }

    public func todzCountTransition() -> some View {
        modifier(TodzCountTransitionModifier())
    }

    public func todzBloom(trigger: Int) -> some View {
        modifier(TodzBloomModifier(trigger: trigger))
    }

    public func todzEntrance() -> some View {
        modifier(TodzEntranceModifier())
    }

    public func todzInsertion() -> some View {
        modifier(TodzInsertionModifier())
    }
}
