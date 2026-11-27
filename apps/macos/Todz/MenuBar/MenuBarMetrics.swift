import SwiftUI

// NB ADR 0112: the day ring and the update dot are the two drawn shapes the form metrics cannot express.
enum MenuBarMetrics {
    static let dayRingDiameter: CGFloat = 22
    static let dayRingLineWidth: CGFloat = 3
    static let updateDotDiameter: CGFloat = 6
}
