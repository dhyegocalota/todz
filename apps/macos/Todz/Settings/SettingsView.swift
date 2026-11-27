import SwiftUI
import TodzKit

private let unknownDayEmailHour = 7
private let unknownDayEmailMinutes = unknownDayEmailHour * DayCloseSchedule.minutesPerHour
private let focusSettingsAddress = "x-apple.systempreferences:com.apple.Focus-Settings.extension"

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(ProactiveGate.self) private var gate
    @Environment(\.openURL) private var openURL
    @Environment(AppUpdater.self) private var appUpdater: AppUpdater?
    @AppStorage(MenuBarBadge.storageKey) private var isCountEnabled = MenuBarBadge.isEnabledByDefault
    @AppStorage(MenuBarOnlyPreference.isOnStorageKey) private var isMenuBarOnlyOn = MenuBarOnlyPreference.isOnByDefault
    @AppStorage(DayClosePreference.isOnStorageKey) private var isDayCloseOn = DayClosePreference.isOnByDefault
    @AppStorage(DayClosePreference.timeStorageKey) private var dayCloseMinutes = DayClosePreference.minutesAfterMidnightByDefault
    @AppStorage(MorningGlancePreference.isOnStorageKey) private var isMorningGlanceOn = MorningGlancePreference.isOnByDefault
    @AppStorage(DayTemperaturePreference.isOnStorageKey) private var isDayTemperatureOn = DayTemperaturePreference.isOnByDefault
    @AppStorage(UsageSharingPreference.isOnStorageKey) private var isUsageSharingOn = UsageSharingPreference.isOnByDefault
    @AppStorage(RibbonPreference.isOnStorageKey) private var isRibbonOn = RibbonPreference.isOnByDefault
    @AppStorage(RespectFocusPreference.isOnStorageKey) private var isRespectFocusOn = RespectFocusPreference.isOnByDefault
    @AppStorage(RibbonPreference.cadenceStorageKey) private var ribbonCadenceName = RibbonPreference.cadenceByDefault.rawValue

    var body: some View {
        Form {
            generalSection
            proactiveSection
            privacySection
            SettingsWorkspaceRows()
            SettingsWorkspaceShortcuts()
            SettingsConnectedApps()
            serverSection
            Section {
                OpenSourceLink()
            }
        }
        .formStyle(.grouped)
        .onAppear { Task { await model.refreshOwnerSettings() } }
        .onChange(of: model.agentNudgeNotice) { _, notice in announce(notice) }
        .onChange(of: model.dayEmailNotice) { _, notice in announce(notice) }
        .onDisappear {
            model.forgetAgentNudgeFailure()
            model.forgetDayEmailFailure()
        }
    }

    private var generalSection: some View {
        Section {
            SettingsRow(title: SettingsCopy.showPendingCount, detail: SettingsCopy.showPendingCountDetail) {
                Toggle(SettingsCopy.showPendingCount, isOn: $isCountEnabled)
                    .toggleStyle(.switch)
                    .labelsHidden()
            }
            SettingsRow(title: SettingsCopy.keepInMenuBar, detail: SettingsCopy.keepInMenuBarDetail) {
                Toggle(SettingsCopy.keepInMenuBar, isOn: $isMenuBarOnlyOn)
                    .toggleStyle(.switch)
                    .labelsHidden()
            }
            SettingsRow(title: SettingsCopy.agentNudge, detail: SettingsCopy.ownerSettingSubtitle(notice: model.agentNudgeNotice, detail: SettingsCopy.agentNudgeDetail)) {
                Toggle(SettingsCopy.agentNudge, isOn: agentNudge)
                    .toggleStyle(.switch)
                    .labelsHidden()
                    .disabled(!model.canChangeAgentNudge)
            }
            SettingsRow(title: SettingsCopy.respectFocus, detail: SettingsCopy.focusQuietSubtitle(notice: FocusQuietNotice(isQuiet: gate.isQuiet))) {
                Toggle(SettingsCopy.respectFocus, isOn: $isRespectFocusOn)
                    .toggleStyle(.switch)
                    .labelsHidden()
            }
            if isRespectFocusOn {
                LabeledContent {
                    Button(SettingsCopy.openFocusSettings, action: openFocusSettings)
                } label: {
                    Text(SettingsCopy.respectFocusHelper)
                        .settingsDetail()
                }
            }
        } header: {
            Text(SettingsCopy.general)
        }
    }

    private var proactiveSection: some View {
        Section {
            SettingsRow(title: SettingsCopy.closeTheDay, detail: SettingsCopy.closeTheDayDetail) {
                HStack {
                    DatePicker(SettingsCopy.closeTheDayTime, selection: dayCloseTime, displayedComponents: .hourAndMinute)
                        .datePickerStyle(.stepperField)
                        .labelsHidden()
                        .disabled(!isDayCloseOn)
                    Toggle(SettingsCopy.closeTheDay, isOn: $isDayCloseOn)
                        .toggleStyle(.switch)
                        .labelsHidden()
                }
            }
            SettingsRow(title: SettingsCopy.morningGlance, detail: SettingsCopy.morningGlanceDetail) {
                Toggle(SettingsCopy.morningGlance, isOn: $isMorningGlanceOn)
                    .toggleStyle(.switch)
                    .labelsHidden()
            }
            SettingsRow(title: SettingsCopy.dayTemperature, detail: SettingsCopy.dayTemperatureDetail) {
                Toggle(SettingsCopy.dayTemperature, isOn: $isDayTemperatureOn)
                    .toggleStyle(.switch)
                    .labelsHidden()
            }
            SettingsRow(title: SettingsCopy.dayEmail, detail: SettingsCopy.ownerSettingSubtitle(notice: model.dayEmailNotice, detail: SettingsCopy.dayEmailDetail)) {
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
            }
            SettingsRow(title: SettingsCopy.menuBarRibbon, detail: ribbonDetail) {
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
            }
        } header: {
            Text(SettingsCopy.proactive)
        }
    }

    private var privacySection: some View {
        Section {
            SettingsWorkspaceLock()
            if let appUpdater {
                SettingsRow(title: UpdateCopy.automaticUpdates, detail: UpdateCopy.automaticUpdatesDetail) {
                    Toggle(UpdateCopy.automaticUpdates, isOn: automaticUpdates(appUpdater))
                        .toggleStyle(.switch)
                        .labelsHidden()
                }
            }
            SettingsRow(title: UsageSharingCopy.toggle, detail: UsageSharingCopy.toggleDetail) {
                Toggle(UsageSharingCopy.toggle, isOn: $isUsageSharingOn)
                    .toggleStyle(.switch)
                    .labelsHidden()
            }
        } header: {
            Text(SettingsCopy.privacyAndUpdates)
        }
    }

    private var serverSection: some View {
        Section {
            ServerAddressForm(layout: .row, exit: {})
        } header: {
            Text(SettingsCopy.server)
        } footer: {
            VersionLine()
        }
    }

    private var agentNudge: Binding<Bool> {
        Binding {
            model.agentNudge == true
        } set: { isEnabled in
            Task { await model.changeAgentNudge(isEnabled: isEnabled) }
        }
    }

    private func automaticUpdates(_ updater: AppUpdater) -> Binding<Bool> {
        Binding {
            updater.automaticallyUpdates
        } set: { isOn in
            updater.setAutomaticallyUpdates(isOn)
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

    private func announce(_ notice: OwnerSettingNotice) {
        guard notice == .notSaved else { return }
        AccessibilityNotification.Announcement(ErrorCopy.changeNotSaved).post()
    }
}
