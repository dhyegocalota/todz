import Foundation

private let noonHour = 12
private let afternoonHour = 15
private let eveningHour = 18

public enum DayTemperatureStep: Sendable, Equatable {
    case plain
    case noon
    case afternoon
    case evening

    private static let startHours: [(step: DayTemperatureStep, hour: Int)] = [
        (.noon, noonHour),
        (.afternoon, afternoonHour),
        (.evening, eveningHour),
    ]

    public static func step(at instant: Date, in timeZone: TimeZone) -> DayTemperatureStep {
        let hour = gregorianCalendar(in: timeZone).component(.hour, from: instant)
        guard let started = startHours.last(where: { hour >= $0.hour }) else { return .plain }
        return started.step
    }

    public static func countOpacity(
        step: DayTemperatureStep,
        isSettingOn: Bool,
        isQuiet: Bool,
        isContrastIncreased: Bool,
        openCount: Int?
    ) -> Double {
        fatalError("DayTemperatureStep.countOpacity is not implemented")
    }
}
