import SwiftUI
import TodzKit

private let sparkleMint = Color(red: 0.549, green: 0.969, blue: 0.816)
private let sparkleCount = 6
private let sparkleDiameter: CGFloat = 3
private let sparkleDistance: CGFloat = 11

private enum SparkleStage: CaseIterable {
    case origin
    case spread

    var spreadFraction: Double {
        switch self {
        case .origin: 0
        case .spread: 1
        }
    }

    var opacity: Double {
        switch self {
        case .origin: 1
        case .spread: 0
        }
    }
}

struct SparkleBurst: View {
    let isBursting: Bool

    var body: some View {
        Color.clear
            .phaseAnimator(SparkleStage.allCases, trigger: isBursting) { content, stage in
                content.overlay { sparkles(stage: stage) }
            } animation: { stage in
                stage == .origin ? nil : MotionToken.sparkle.animation
            }
    }

    private func sparkles(stage: SparkleStage) -> some View {
        ZStack {
            ForEach(0..<sparkleCount, id: \.self) { index in
                Circle()
                    .fill(sparkleMint)
                    .frame(width: sparkleDiameter, height: sparkleDiameter)
                    .offset(offset(of: index, spreadFraction: stage.spreadFraction))
            }
        }
        .opacity(isBursting ? stage.opacity : 0)
    }

    private func offset(of index: Int, spreadFraction: Double) -> CGSize {
        let angle = 2 * Double.pi * Double(index) / Double(sparkleCount)
        let distance = sparkleDistance * spreadFraction
        return CGSize(width: distance * cos(angle), height: distance * sin(angle))
    }
}
