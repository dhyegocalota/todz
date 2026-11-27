import SwiftUI
import TodzKit

private let checkLineWidth: CGFloat = 1.6
private let closedProgress = 1.0
private let ringStart = 0.0
private let quarterTurn = Angle.degrees(-90)

struct MenuBarDayRing: View {
    let progress: Double
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn
    @State private var isBursting = false

    var body: some View {
        ZStack {
            Circle()
                .stroke(.fill.quaternary, lineWidth: MenuBarMetrics.dayRingLineWidth)
            Circle()
                .trim(from: ringStart, to: progress)
                .stroke(Color.accentColor, style: StrokeStyle(lineWidth: MenuBarMetrics.dayRingLineWidth, lineCap: .round))
                .rotationEffect(quarterTurn)
            Circle()
                .fill(Color.accentColor)
                .opacity(isClosed ? 1 : 0)
            CheckmarkMark()
                .trim(from: ringStart, to: isClosed ? closedProgress : ringStart)
                .stroke(Color.white, style: StrokeStyle(lineWidth: checkLineWidth, lineCap: .round, lineJoin: .round))
                .transaction { if isReduceMotionOn { $0.animation = nil } }
            if !isReduceMotionOn {
                SparkleBurst(isBursting: isBursting)
            }
        }
        .frame(width: MenuBarMetrics.dayRingDiameter, height: MenuBarMetrics.dayRingDiameter)
        .todzMotion(.ringFill, value: progress)
        .onChange(of: isClosed) { _, isNowClosed in isBursting = isNowClosed }
        .accessibilityHidden(true)
    }

    private var isClosed: Bool {
        progress >= closedProgress
    }
}
