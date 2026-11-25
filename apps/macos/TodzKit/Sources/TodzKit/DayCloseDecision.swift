import Foundation

public enum DayCloseDecision: Equatable, Sendable {
    case off
    case notYet(next: Date)
    case due
    case doneToday(next: Date)
}
