import SwiftUI
import TodzKit

let subtitleLines = 2
private let focusSettingsAddress = "x-apple.systempreferences:com.apple.Focus-Settings.extension"

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(ProactiveGate.self) private var gate
    @Environment(\.openURL) private var openURL
    @AppStorage(MenuBarBadge.storageKey) private var isCountEnabled = MenuBarBadge.isEnabledByDefault
    @AppStorage(DayClosePreference.isOnStorageKey) private var isDayCloseOn = DayClosePreference.isOnByDefault
    @AppStorage(DayClosePreference.timeStorageKey) private var dayCloseMinutes = DayClosePreference.minutesAfterMidnightByDefault
    @AppStorage(MorningGlancePreference.isOnStorageKey) private var isMorningGlanceOn = MorningGlancePreference.isOnByDefault
    @AppStorage(DayTemperaturePreference.isOnStorageKey) private var isDayTemperatureOn = DayTemperaturePreference.isOnByDefault
    @AppStorage(RibbonPreference.isOnStorageKey) private var isRibbonOn = RibbonPreference.isOnByDefault
    @AppStorage(RibbonPreference.cadenceStorageKey) private var ribbonCadenceName = RibbonPreference.cadenceByDefault.rawValue

    var body: some View {
        Form {
            Toggle(isOn: $isCountEnabled) {
                Text(SettingsCopy.showPendingCount)
                Text(SettingsCopy.showPendingCountDetail)
            }
            .toggleStyle(.switch)
            Toggle(isOn: agentNudge) {
                Text(SettingsCopy.agentNudge)
                Text(SettingsCopy.agentNudgeSubtitle(notice: model.agentNudgeNotice))
                    .lineLimit(subtitleLines, reservesSpace: true)
            }
            .toggleStyle(.switch)
            .disabled(!model.canChangeAgentNudge)
            LabeledContent {
                Button(SettingsCopy.openFocusSettings, action: openFocusSettings)
            } label: {
                Text(SettingsCopy.focusQuiet)
                Text(SettingsCopy.focusQuietSubtitle(notice: FocusQuietNotice(isQuiet: gate.isQuiet)))
                    .lineLimit(subtitleLines, reservesSpace: true)
            }
            LabeledContent {
                HStack {
                    DatePicker(SettingsCopy.closeTheDayTime, selection: dayCloseTime, displayedComponents: .hourAndMinute)
                        .datePickerStyle(.stepperField)
                        .labelsHidden()
                        .disabled(!isDayCloseOn)
                    Toggle(SettingsCopy.closeTheDay, isOn: $isDayCloseOn)
                        .toggleStyle(.switch)
                        .labelsHidden()
                }
            } label: {
                Text(SettingsCopy.closeTheDay)
                Text(SettingsCopy.closeTheDayDetail)
                    .lineLimit(subtitleLines, reservesSpace: true)
            }
            Toggle(isOn: $isMorningGlanceOn) {
                Text(SettingsCopy.morningGlance)
                Text(SettingsCopy.morningGlanceDetail)
                    .lineLimit(subtitleLines, reservesSpace: true)
            }
            .toggleStyle(.switch)
            Toggle(isOn: $isDayTemperatureOn) {
                Text(SettingsCopy.dayTemperature)
                Text(SettingsCopy.dayTemperatureDetail)
                    .lineLimit(subtitleLines, reservesSpace: true)
            }
            .toggleStyle(.switch)
            LabeledContent {
                HStack {
                    Picker(SettingsCopy.menuBarRibbonCadence, selection: ribbonCadence) {
                        ForEach(RibbonCadence.allCases, id: \.self) { cadence in
                            Text(SettingsCopy.cadenceName(cadence)).tag(cadence)
                        }
                    }
                    .pickerStyle(.menu)
                    .labelsHidden()
                    .disabled(!isRibbonOn)
                    Toggle(SettingsCopy.menuBarRibbon, isOn: $isRibbonOn)
                        .toggleStyle(.switch)
                        .labelsHidden()
                }
            } label: {
                Text(SettingsCopy.menuBarRibbon)
                Text(ribbonDetail)
                    .lineLimit(subtitleLines, reservesSpace: true)
            }
            Section {
                ServerAddressForm(layout: .row, exit: {})
            }
        }
        .formStyle(.grouped)
        .fixedSize(horizontal: false, vertical: true)
        .onChange(of: model.agentNudgeNotice) { _, notice in announce(notice) }
        .onDisappear { model.forgetAgentNudgeFailure() }
    }

    private var agentNudge: Binding<Bool> {
        Binding {
            model.agentNudge == true
        } set: { isEnabled in
            Task { await model.changeAgentNudge(isEnabled: isEnabled) }
        }
    }

    private var dayCloseTime: Binding<Date> {
        Binding {
            let minutes = DayClosePreference.pickerMinutes(stored: dayCloseMinutes)
            return DayCloseSchedule.instant(day: model.today, minutesAfterMidnight: minutes, timeZone: model.timeZone)
        } set: { time in
            dayCloseMinutes = DayCloseSchedule.minutesAfterMidnight(of: time, timeZone: model.timeZone)
        }
    }

    private var ribbonCadence: Binding<RibbonCadence> {
        Binding {
            RibbonPreference.pickerCadence(stored: ribbonCadenceName)
        } set: { cadence in
            ribbonCadenceName = cadence.rawValue
        }
    }

    private var ribbonDetail: String {
        let isOverlappingDayClose = isDayCloseOn && ribbonCadence.wrappedValue == .dayClose
        guard isOverlappingDayClose else { return SettingsCopy.menuBarRibbonDetail }
        return SettingsCopy.menuBarRibbonDayCloseOverlap
    }

    private func openFocusSettings() {
        guard let focusSettings = URL(string: focusSettingsAddress) else { return }
        openURL(focusSettings)
    }

    private func announce(_ notice: AgentNudgeNotice) {
        guard notice == .notSaved else { return }
        AccessibilityNotification.Announcement(ErrorCopy.changeNotSaved).post()
    }
}
