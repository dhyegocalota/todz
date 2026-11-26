import Observation
import SwiftUI
import TodzKit

let titleFlightSpace = "titleFlightSpace"

@MainActor @Observable final class TitleFlightFrames {
    @ObservationIgnored var sidebarOrigins: [SidebarItem: TitleFlightPoint] = [:]
    @ObservationIgnored var headerOrigin: TitleFlightPoint?
}

private func origin(of proxy: GeometryProxy) -> TitleFlightPoint {
    let frame = proxy.frame(in: .named(titleFlightSpace))
    return TitleFlightPoint(x: frame.minX, y: frame.minY)
}

private struct TitleFlightSourceModifier: ViewModifier {
    let item: SidebarItem
    @Environment(TitleFlightFrames.self) private var frames

    func body(content: Content) -> some View {
        content.onGeometryChange(for: TitleFlightPoint.self, of: origin) { frames.sidebarOrigins[item] = $0 }
    }
}

private struct TitleFlightDestinationModifier: ViewModifier {
    let item: SidebarItem
    @Environment(TitleFlightFrames.self) private var frames
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn
    @State private var start = TitleFlightStart(offsetX: 0, offsetY: 0, opacity: 1)

    func body(content: Content) -> some View {
        content
            .onGeometryChange(for: TitleFlightPoint.self, of: origin) { frames.headerOrigin = $0 }
            .offset(x: start.offsetX, y: start.offsetY)
            .opacity(start.opacity)
            .onChange(of: item) { _, next in fly(to: next) }
    }

    private func fly(to next: SidebarItem) {
        guard let rest = frames.headerOrigin else { return }
        var unanimated = Transaction()
        unanimated.animation = nil
        withTransaction(unanimated) {
            start = TitleFlight.start(source: frames.sidebarOrigins[next], rest: rest, isMotionReduced: isReduceMotionOn)
        }
        let animation = TitleFlight.token(isMotionReduced: isReduceMotionOn).animation
        Task { withAnimation(animation) { start = TitleFlightStart(offsetX: 0, offsetY: 0, opacity: 1) } }
    }
}

extension View {
    func titleFlightSource(item: SidebarItem) -> some View {
        modifier(TitleFlightSourceModifier(item: item))
    }

    func titleFlightDestination(item: SidebarItem) -> some View {
        modifier(TitleFlightDestinationModifier(item: item))
    }
}
