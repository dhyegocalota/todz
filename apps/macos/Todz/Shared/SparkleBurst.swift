import SwiftUI
import TodzKit

private let sparkleMint = Color(red: 0.549, green: 0.969, blue: 0.816)
private let sparkleCount = 6
private let sparkleDiameter: CGFloat = 3
private let sparkleDistance: CGFloat = 11

struct SparkleBurst: View {
    let isBursting: Bool
    @State private var isSpread = false

    var body: some View {
        ZStack {
            ForEach(0..<sparkleCount, id: \.self) { index in
                Circle()
                    .fill(sparkleMint)
                    .frame(width: sparkleDiameter, height: sparkleDiameter)
                    .offset(offset(of: index))
            }
        }
        .opacity(MotionBurst.opacity(isBursting: isBursting, isSpread: isSpread))
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
        let angle = 2 * Double.pi * Double(index) / Double(sparkleCount)
        let distance = sparkleDistance * MotionBurst.spreadFraction(isSpread: isSpread)
        return CGSize(width: distance * cos(angle), height: distance * sin(angle))
    }
}
