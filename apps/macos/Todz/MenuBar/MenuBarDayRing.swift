import SwiftUI
import TodzKit

private let checkLineWidth: CGFloat = 1.6
private let closedProgress = 1.0
private let ringStart = 0.0
private let quarterTurn = Angle.degrees(-90)

struct MenuBarDayRing: View {
    let progress: Double
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn

    var body: some View {
        let isClosed = progress >= closedProgress
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
                SparkleBurst(isBursting: isClosed)
            }
        }
        .frame(width: MenuBarMetrics.dayRingDiameter, height: MenuBarMetrics.dayRingDiameter)
        .todzAnimation(.settle, value: progress)
        .accessibilityHidden(true)
    }
}
