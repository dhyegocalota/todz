import Foundation
import Observation
import TodzKit

extension AppDelegate {
    func startDayTemperature() {
        dayTemperatureObservation = NotificationCenter.default.addObserver(
            forName: UserDefaults.didChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.showDayTemperature()
                Task { await self?.focusSwitch.preferencesChanged() }
            }
        }
        observeQuietGate()
        showDayTemperature()
    }

    private func showDayTemperature() {
        let isShown = DayTemperatureTone.isShown(isSettingOn: dayTemperaturePreference.isOn, isQuiet: gate.isQuiet)
        model.showDayTemperature(isShown)
    }

    private func observeQuietGate() {
        withObservationTracking {
            _ = gate.isQuiet
        } onChange: { [weak self] in
            MainActor.assumeIsolated {
                self?.quietGateReaction = Task { [weak self] in
                    self?.showDayTemperature()
                    self?.observeQuietGate()
                }
            }
        }
    }
}
