import AppIntents
import AppKit
import TodzKit
import WidgetKit

private let cacheFolderName = "Cache"
private let focusFilterReadTimeout: Duration = .seconds(3)

private func isFocusFilterQuiet() async -> Bool {
    do {
        return try await TodzFocusFilter.current.isQuiet
    } catch {
        return false
    }
}

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate {
    let model = AppModel(
        defaultURL: AppConfiguration.defaultURL,
        preference: ServerPreference(defaults: .standard, domainName: AppConfiguration.defaultsDomain),
        connect: { ServerConnection(service: OwnerAPI(baseURL: $0.url), signals: SocketChangeSignals(baseURL: $0.url)) },
        probe: { await OwnerAPI(baseURL: $0.url, transport: OwnerAPI.probeTransport).probe(typedAddress: $0) },
        linkScheme: AppConfiguration.linkScheme,
        vault: FileSessionVault(folder: AppConfiguration.sessionFolder),
        pendingLinks: FilePendingLinkVault(folder: AppConfiguration.sessionFolder),
        store: FileSyncStore(folder: AppConfiguration.sessionFolder.appending(path: cacheFolderName)),
        cacheScheduler: .background,
        widgetStore: AppConfiguration.widgetStore,
        reloadWidgets: { WidgetCenter.shared.reloadAllTimelines() },
        timeZone: .autoupdatingCurrent,
        pause: { try await Task.sleep(for: $0) }
    )
    let windowState = MainWindowState()
    let panel = MenuBarPanel()
    let gate: ProactiveGate
    var dayChangeObservation: (any NSObjectProtocol)?
    var dayTemperatureObservation: (any NSObjectProtocol)?
    var quietGateReaction: Task<Void, Never>?
    var windowObservations: [any NSObjectProtocol] = []
    private var launchSurfaceStart = LaunchSurfaceStart.now
    private var engagementObservation: (any NSObjectProtocol)?
    private var isAwaitingEngagement = false
    private var launchReading: Task<Void, Never>?
    let dayTemperaturePreference = DayTemperaturePreference(defaults: .standard, domainName: AppConfiguration.defaultsDomain)
    let menuBarOnlyPreference = MenuBarOnlyPreference(defaults: .standard, domainName: AppConfiguration.defaultsDomain)
    private(set) lazy var dayClose = DayCloseCoordinator(
        gate: gate,
        preference: DayClosePreference(defaults: .standard, domainName: AppConfiguration.defaultsDomain),
        timeZone: model.timeZone,
        openCount: { [model] in model.todayHeadingCount },
        isScreenLocked: { ScreenLock.isLocked },
        isPopoverVisible: { [panel] in panel.isShown },
        openPopover: { [panel] in await panel.open() },
        closePopover: { [panel] in panel.close() }
    )
    private lazy var dayCloseScheduler = DayCloseScheduler(coordinator: dayClose)
    private(set) lazy var dayTemperatureClock = DayTemperatureClock(
        now: Date.init,
        timeZone: { [model] in model.timeZone },
        isOn: { [dayTemperaturePreference] in dayTemperaturePreference.isOn },
        pause: { try await Task.sleep(for: $0) }
    )
    private lazy var dayTemperatureScheduler = DayTemperatureScheduler(clock: dayTemperatureClock)
    let ribbonStrips = MenuBarRibbonStripCache()
    private(set) lazy var ribbon = makeRibbon()
    lazy var ribbonScheduler = RibbonScheduler(coordinator: ribbon, model: model)
    private lazy var morningGlancePresenter = MorningGlancePresenter(windowState: windowState)
    private(set) lazy var morningGlance = MorningGlanceCoordinator.app(
        model: model,
        gate: gate,
        dayClose: dayClose,
        popover: panel,
        presenter: morningGlancePresenter
    )
    private lazy var morningGlanceTrigger = MorningGlanceTrigger(coordinator: morningGlance)

    override init() {
        let gate = ProactiveGate(respectsFocus: true)
        AppDependencyManager.shared.add(dependency: gate)
        self.gate = gate
        super.init()
        AppDependencyManager.shared.add(dependency: self.model)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        PerfProbe.shared?.start(model: model)
        decideLaunchSurfaceStart(notification)
        observeWidgetRequests()
        observeDayChanges()
        observeWindows(LaunchActivation.of(isDefaultLaunch: notification.userInfo?[NSApplication.launchIsDefaultUserInfoKey] as? Bool))
        launchReading = Task {
            await readFocusFilter()
            startDayTemperature()
            dayTemperatureScheduler.start()
            guard launchSurfaceStart == .now else { return }
            startProactiveSurfaces()
        }
    }

    private func decideLaunchSurfaceStart(_ notification: Notification) {
        launchSurfaceStart = LaunchSurfaceStart.of(
            isDefaultLaunch: notification.userInfo?[NSApplication.launchIsDefaultUserInfoKey] as? Bool,
            isActivationProhibited: NSApp.activationPolicy() == .prohibited
        )
        guard launchSurfaceStart == .afterTheOwnerEngages else { return }
        isAwaitingEngagement = true
        panel.onShown = { [weak self] in self?.ownerEngaged() }
        engagementObservation = NotificationCenter.default.addObserver(forName: NSApplication.didUpdateNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                guard NSApp.activationPolicy() != .prohibited else { return }
                self?.ownerEngaged()
            }
        }
    }

    // NB ADR 0066: a launch for an intent starts no pushed surface until the owner engages the app.
    private func ownerEngaged() {
        guard isAwaitingEngagement else { return }
        isAwaitingEngagement = false
        panel.onShown = nil
        engagementObservation.map(NotificationCenter.default.removeObserver)
        engagementObservation = nil
        Task {
            await launchReading?.value
            startProactiveSurfaces()
        }
    }

    private func startProactiveSurfaces() {
        startRibbon()
        dayCloseScheduler.start()
        morningGlanceTrigger.start()
    }

    func applicationWillTerminate(_ notification: Notification) {
        model.flushCache()
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        ownerEngaged()
        Task { await model.takeWidgetRequests() }
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        guard let link = urls.compactMap({ IncomingLink(url: $0, scheme: AppConfiguration.linkScheme) }).last else { return }
        switch link {
        case let .signIn(signInLink): windowState.waitingSignInLink = signInLink
        case let .widget(widgetLink): windowState.open(widgetLink, from: .widget)
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        windowState.isMainWindowRequested = true
        return true
    }

    // NB ADR 0031: the app keeps running in the menu bar when the main window closes; ⌘Q quits.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    private func readFocusFilter() async {
        let (settlements, settle) = AsyncStream.makeStream(of: Void.self)
        let timeout = Task { [gate] in
            try? await Task.sleep(for: focusFilterReadTimeout)
            guard !Task.isCancelled else { return }
            gate.applyLaunchRead(isQuiet: true)
            settle.yield()
        }
        Task { [gate] in
            let isQuiet = await isFocusFilterQuiet()
            timeout.cancel()
            gate.applyLaunchRead(isQuiet: isQuiet)
            settle.yield()
        }
        for await _ in settlements { return }
    }
}
