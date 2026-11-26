import SwiftUI

extension MotionToken {
    public var animation: Animation {
        let seconds = Double(durationMilliseconds) / MotionTiming.millisecondsPerSecond
        switch curve {
        case let .spring(response, dampingFraction):
            return .spring(response: response, dampingFraction: dampingFraction)
        case .easeOut:
            return .easeOut(duration: seconds)
        case .ease:
            return .easeInOut(duration: seconds)
        }
    }
}
