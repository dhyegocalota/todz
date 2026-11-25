import AppIntents
import AppKit
import TodzKit
import WidgetKit

private let cacheFolderName = "Cache"
private let focusFilterReadTimeoutMilliseconds = 3000

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate {
    let model = AppModel(
        service: OwnerAPI(baseURL: AppConfiguration.baseURL),
        vault: FileSessionVault(folder: AppConfiguration.sessionFolder),
        pendingLinks: FilePendingLinkVault(folder: AppConfiguration.sessionFolder),
        store: FileSyncStore(folder: AppConfiguration.sessionFolder.appending(path: cacheFolderName)),
        widgetStore: AppConfiguration.widgetStore,
        reloadWidgets: { WidgetCenter.shared.reloadAllTimelines() },
        signals: SocketChangeSignals(baseURL: AppConfiguration.baseURL),
        timeZone: .autoupdatingCurrent,
        pause: { try await Task.sleep(for: $0) }
    )
    let windowState = MainWindowState()
    let panel = MenuBarPanel()
    let gate: ProactiveGate
    var dayChangeObservation: (any NSObjectProtocol)?
    private(set) lazy var dayClose = DayCloseCoordinator(
        gate: gate,
        defaults: .standard,
        timeZone: model.timeZone,
        openCount: { [model] in model.todayHeadingCount },
        isScreenLocked: { ScreenLock.isLocked },
        openPopover: { [panel] in await panel.open() }
    )
    private lazy var dayCloseScheduler = DayCloseScheduler(coordinator: dayClose)

    override init() {
        let gate = ProactiveGate()
        AppDependencyManager.shared.add(dependency: gate)
        self.gate = gate
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        observeWidgetRequests()
        observeDayChanges()
        Task {
            await readFocusFilter()
            dayCloseScheduler.start()
        }
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        Task { await model.takeWidgetRequests() }
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        guard let link = urls.compactMap(IncomingLink.init(url:)).last else { return }
        switch link {
        case let .signIn(signInLink): windowState.waitingSignInLink = signInLink
        case let .widget(widgetLink): windowState.waitingLink = widgetLink
        }
    }

    // NB ADR 0031: the app keeps running in the menu bar when the main window closes; ⌘Q quits.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    private func readFocusFilter() async {
        let (answers, answer) = AsyncStream.makeStream(of: Bool?.self)
        Task {
            answer.yield(try? await TodzFocusFilter.current.isQuiet)
            answer.finish()
        }
        Task {
            try? await Task.sleep(for: .milliseconds(focusFilterReadTimeoutMilliseconds))
            answer.yield(nil)
            answer.finish()
        }
        var iterator = answers.makeAsyncIterator()
        guard let firstAnswer = await iterator.next(), let isQuiet = firstAnswer else { return }
        gate.applyLaunchRead(isQuiet: isQuiet)
    }
}
