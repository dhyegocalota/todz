import SwiftUI
import TodzKit

let subtitleLines = 2
private let unknownDayEmailHour = 7
private let unknownDayEmailMinutes = unknownDayEmailHour * DayCloseSchedule.minutesPerHour
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

    var body: some View {
        Form {
            Toggle(isOn: $isCountEnabled) {
                Text(SettingsCopy.showPendingCount)
                Text(SettingsCopy.showPendingCountDetail)
            }
            .toggleStyle(.switch)
            Toggle(isOn: agentNudge) {
                Text(SettingsCopy.agentNudge)
                Text(SettingsCopy.ownerSettingSubtitle(notice: model.agentNudgeNotice, detail: SettingsCopy.agentNudgeDetail))
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
                    DatePicker(SettingsCopy.dayEmailTime, selection: dayEmailTime, displayedComponents: .hourAndMinute)
                        .datePickerStyle(.stepperField)
                        .labelsHidden()
                        .disabled(!canChangeDayEmailTime)
                    Toggle(SettingsCopy.dayEmail, isOn: dayEmail)
                        .toggleStyle(.switch)
                        .labelsHidden()
                        .disabled(!model.canChangeDayEmail)
                }
            } label: {
                Text(SettingsCopy.dayEmail)
                Text(SettingsCopy.ownerSettingSubtitle(notice: model.dayEmailNotice, detail: SettingsCopy.dayEmailDetail))
                    .lineLimit(subtitleLines, reservesSpace: true)
            }
            Section {
                ServerAddressForm(layout: .row, exit: {})
            } footer: {
                VersionLine()
            }
        }
        .formStyle(.grouped)
        .fixedSize(horizontal: false, vertical: true)
        .onChange(of: model.agentNudgeNotice) { _, notice in announce(notice) }
        .onChange(of: model.dayEmailNotice) { _, notice in announce(notice) }
        .onDisappear {
            model.forgetAgentNudgeFailure()
            model.forgetDayEmailFailure()
        }
    }

    private var agentNudge: Binding<Bool> {
        Binding {
            model.agentNudge == true
        } set: { isEnabled in
            Task { await model.changeAgentNudge(isEnabled: isEnabled) }
        }
    }

    private var dayEmail: Binding<Bool> {
        Binding {
            model.dayEmail == true
        } set: { isEnabled in
            Task { await model.changeDayEmail(isEnabled: isEnabled) }
        }
    }

    private var canChangeDayEmailTime: Bool {
        model.canChangeDayEmail && model.dayEmail == true
    }

    private var dayEmailTime: Binding<Date> {
        Binding {
            guard let minutes = model.dayEmailMinutes else { return dayEmailInstant(minutes: unknownDayEmailMinutes) }
            return dayEmailInstant(minutes: minutes)
        } set: { time in
            let minutes = DayCloseSchedule.minutesAfterMidnight(of: time, timeZone: model.timeZone)
            Task { await model.changeDayEmail(minutes: minutes) }
        }
    }

    private func dayEmailInstant(minutes: Int) -> Date {
        DayCloseSchedule.instant(day: model.today, minutesAfterMidnight: minutes, timeZone: model.timeZone)
    }

    private var dayCloseTime: Binding<Date> {
        Binding {
            let minutes = DayClosePreference.pickerMinutes(stored: dayCloseMinutes)
            return DayCloseSchedule.instant(day: model.today, minutesAfterMidnight: minutes, timeZone: model.timeZone)
        } set: { time in
            dayCloseMinutes = DayCloseSchedule.minutesAfterMidnight(of: time, timeZone: model.timeZone)
        }
    }

    private func openFocusSettings() {
        guard let focusSettings = URL(string: focusSettingsAddress) else { return }
        openURL(focusSettings)
    }

    private func announce(_ notice: OwnerSettingNotice) {
        guard notice == .notSaved else { return }
        AccessibilityNotification.Announcement(ErrorCopy.changeNotSaved).post()
    }
}
