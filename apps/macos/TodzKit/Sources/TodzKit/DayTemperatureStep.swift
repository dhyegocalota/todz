import Foundation

public enum DayTemperatureStep: Sendable, Equatable {
    case plain
    case noon
    case afternoon
    case evening

    public static func step(at instant: Date, in timeZone: TimeZone) -> DayTemperatureStep {
        fatalError("DayTemperatureStep.step is not implemented")
    }
}
