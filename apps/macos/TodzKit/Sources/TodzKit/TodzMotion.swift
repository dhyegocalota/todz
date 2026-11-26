import SwiftUI

private let insertedScale = 0.92

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
    @State private var isBloomed = true

    func body(content: Content) -> some View {
        content
            .scaleEffect(MotionBloom.scale(isBloomed: isBloomed, isReduceMotionOn: isReduceMotionOn))
            .opacity(MotionBloom.opacity(isBloomed: isBloomed))
            .animation(MotionRule.token(.bloom, isReduceMotionOn: isReduceMotionOn).animation, value: isBloomed)
            .onChange(of: trigger) {
                var dimmed = Transaction()
                dimmed.animation = nil
                withTransaction(dimmed) { isBloomed = false }
                Task { isBloomed = true }
            }
    }
}

private struct TodzEntranceModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn
    @State private var isPresented = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(MotionBloom.scale(isBloomed: isPresented, isReduceMotionOn: isReduceMotionOn))
            .opacity(MotionBloom.opacity(isBloomed: isPresented))
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
