import SwiftUI
import TodzKit

private let sparkleMint = Color(red: 0.549, green: 0.969, blue: 0.816)
private let sparkleCount = 6
private let sparkleDiameter: CGFloat = 3
private let sparkleDistance: CGFloat = 11

struct SparkleBurst: View {
    let isBursting: Bool
    @State private var isSpread = false
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn

    var body: some View {
        ZStack {
            ForEach(0..<sparkleCount, id: \.self) { index in
                Circle()
                    .fill(sparkleMint)
                    .frame(width: sparkleDiameter, height: sparkleDiameter)
                    .offset(offset(of: index))
            }
        }
        .opacity(isBursting && !isSpread ? 1 : 0)
        .todzAnimation(.sparkle, value: isSpread)
        .onChange(of: isBursting) { _, isNowBursting in
            guard isNowBursting else {
                isSpread = false
                return
            }
            Task { isSpread = true }
        }
    }

    private func offset(of index: Int) -> CGSize {
        guard isSpread, !isReduceMotionOn else { return .zero }
        let angle = 2 * Double.pi * Double(index) / Double(sparkleCount)
        return CGSize(width: sparkleDistance * cos(angle), height: sparkleDistance * sin(angle))
    }
}
