import SwiftUI

private struct TodzAnimationModifier<Value: Equatable>: ViewModifier {
    let token: MotionToken
    let value: Value
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn

    func body(content: Content) -> some View {
        content.animation(MotionRule.token(token, isReduceMotionOn: isReduceMotionOn).animation, value: value)
    }
}

private let reducedPressDimmedOpacity = 0.7

extension MotionSpec {
    fileprivate var animation: Animation? {
        guard let token else { return nil }
        return token.animation.delay(Double(delayMilliseconds) / millisecondsPerSecond)
    }
}

private struct TodzMotionModifier<Value: Equatable>: ViewModifier {
    let moment: MotionMoment
    let value: Value
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn

    func body(content: Content) -> some View {
        content.animation(MotionSpec.of(moment, isReduceMotionOn: isReduceMotionOn, index: 0).animation, value: value)
    }
}

private struct TodzCascadeModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn
    @State private var index: Int?
    @State private var isPresented: Bool

    init(index: Int?) {
        _index = State(initialValue: index)
        _isPresented = State(initialValue: index == nil)
    }

    func body(content: Content) -> some View {
        content
            .opacity(isPresented ? 1 : 0)
            .animation(animation, value: isPresented)
            .onAppear { isPresented = true }
    }

    private var animation: Animation? {
        guard let index else { return nil }
        return MotionSpec.of(.workspaceSwitch, isReduceMotionOn: isReduceMotionOn, index: index).animation
    }
}

public struct TodzPressButtonStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label.modifier(TodzPressModifier(isPressed: configuration.isPressed))
    }
}

private struct TodzPressModifier: ViewModifier {
    let isPressed: Bool
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressed ? spec.transform.scale : 1)
            .opacity(isPressed && isReduceMotionOn ? reducedPressDimmedOpacity : 1)
            .animation(spec.animation, value: isPressed)
    }

    private var spec: MotionSpec {
        MotionSpec.of(.press, isReduceMotionOn: isReduceMotionOn, index: 0)
    }
}

private struct TodzCountTransitionModifier: ViewModifier {
    let countsDown: Bool
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn

    func body(content: Content) -> some View {
        content.contentTransition(isCrossfaded ? .opacity : .numericText(countsDown: countsDown))
    }

    private var isCrossfaded: Bool {
        MotionRule.token(.snap, isReduceMotionOn: isReduceMotionOn) == .crossfade
    }
}

private struct TodzSymbolTransitionModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn

    func body(content: Content) -> some View {
        content.contentTransition(isCrossfaded ? .opacity : .symbolEffect(.replace))
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
    @State private var isPresented: Bool

    init(isEntering: Bool) {
        _isPresented = State(initialValue: !isEntering)
    }

    func body(content: Content) -> some View {
        content
            .scaleEffect(MotionBloom.scale(isBloomed: isPresented, isReduceMotionOn: isReduceMotionOn))
            .opacity(MotionBloom.opacity(isBloomed: isPresented))
            .animation(MotionRule.token(.bloom, isReduceMotionOn: isReduceMotionOn).animation, value: isPresented)
            .onAppear { isPresented = true }
    }
}

extension View {
    public func todzAnimation(_ token: MotionToken, value: some Equatable) -> some View {
        modifier(TodzAnimationModifier(token: token, value: value))
    }

    public func todzMotion(_ moment: MotionMoment, value: some Equatable) -> some View {
        modifier(TodzMotionModifier(moment: moment, value: value))
    }

    public func todzCascade(index: Int?) -> some View {
        modifier(TodzCascadeModifier(index: index))
    }

    public func todzCountTransition(countsDown: Bool = false) -> some View {
        modifier(TodzCountTransitionModifier(countsDown: countsDown))
    }

    public func todzSymbolTransition() -> some View {
        modifier(TodzSymbolTransitionModifier())
    }

    public func todzBloom(trigger: Int) -> some View {
        modifier(TodzBloomModifier(trigger: trigger))
    }

    public func todzEntrance(isEntering: Bool = true) -> some View {
        modifier(TodzEntranceModifier(isEntering: isEntering))
    }
}

extension ButtonStyle where Self == TodzPressButtonStyle {
    public static var todzPress: TodzPressButtonStyle { TodzPressButtonStyle() }
}
