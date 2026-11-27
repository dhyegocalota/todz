import SwiftUI

private struct ShakeEffect: GeometryEffect {
    var progress: Double
    let isReduceMotionOn: Bool

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: MotionShake.offset(progress: progress, isReduceMotionOn: isReduceMotionOn), y: 0))
    }
}

private struct TodzShakeModifier: ViewModifier {
    let trigger: Int
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn
    @State private var progress = 0.0

    func body(content: Content) -> some View {
        content
            .modifier(ShakeEffect(progress: progress, isReduceMotionOn: isReduceMotionOn))
            .onChange(of: trigger) {
                progress = 0
                withAnimation(.linear(duration: MotionShake.duration)) { progress = 1 }
            }
    }
}

extension View {
    public func todzShake(trigger: Int) -> some View {
        modifier(TodzShakeModifier(trigger: trigger))
    }
}
