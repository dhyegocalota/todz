import SwiftUI

private let startX = 0.26
private let startY = 0.52
private let turnX = 0.43
private let turnY = 0.69
private let endX = 0.76
private let endY = 0.34

struct CheckmarkMark: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: point(startX, startY, in: rect))
        path.addLine(to: point(turnX, turnY, in: rect))
        path.addLine(to: point(endX, endY, in: rect))
        return path
    }

    private func point(_ fractionX: Double, _ fractionY: Double, in rect: CGRect) -> CGPoint {
        CGPoint(x: rect.minX + rect.width * fractionX, y: rect.minY + rect.height * fractionY)
    }
}
