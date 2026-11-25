import SwiftUI
import TodzKit

private let hiddenDialogTitle = ""

enum ServerFormLayout {
    case row
    case column
}

struct ServerAddressForm: View {
    let layout: ServerFormLayout
    let exit: () -> Void
    @Environment(AppModel.self) private var model
    @State private var text = ""
    @State private var flow = ServerSwitchFlow()
    @State private var target: ServerAddress?
    @State private var check: Task<Void, Never>?
    @FocusState private var isFieldFocused: Bool

    var body: some View {
        switch layout {
        case .row:
            LabeledContent {
                cloudButton
            } label: {
                Text(SettingsCopy.server)
                Text(SettingsCopy.serverDetail)
                    .lineLimit(subtitleLines, reservesSpace: true)
            }
            editor
        case .column:
            editor
        }
    }

    private var editor: some View {
        VStack(alignment: layout == .row ? .leading : .center) {
            switch layout {
            case .row:
                HStack {
                    field
                    action
                }
            case .column:
                field
                action
                cloudButton
            }
            statusLine
        }
        .task(id: model.serverURL) { text = model.serverURL.origin }
        .task {
            guard layout == .column else { return }
            await Task.yield()
            isFieldFocused = true
        }
        .onChange(of: flow.state) { _, state in present(state) }
        .onDisappear(perform: close)
        .confirmationDialog(confirmationTitle, isPresented: isConfirming, titleVisibility: .visible) {
            Button(SettingsCopy.confirmSwitch, role: .destructive, action: confirm)
            Button(SheetCopy.cancel, role: .cancel) {}
                .keyboardShortcut(.defaultAction)
        } message: {
            Text(confirmationMessage)
        }
    }

    private var field: some View {
        TextField(SettingsCopy.serverPlaceholder, text: $text)
            .textFieldStyle(.roundedBorder)
            .autocorrectionDisabled()
            .accessibilityLabel(SettingsCopy.serverAddressLabel)
            .focused($isFieldFocused)
            .disabled(isInFlight)
            .onSubmit(submit)
            .onExitCommand(perform: escape)
            .onChange(of: text) {
                guard text != model.serverURL.origin else { return }
                flow.reset()
            }
    }

    @ViewBuilder private var action: some View {
        switch flow.state {
        case .checking:
            HStack {
                ProgressView(SettingsCopy.checkingServer)
                    .controlSize(.small)
                Button(SheetCopy.cancel, action: cancelCheck)
            }
        case .switching:
            ProgressView(SettingsCopy.switchingServer)
                .controlSize(.small)
        case .confirming:
            EmptyView()
        case .idle, .refused, .notTodz, .answersAs, .alreadyInUse, .switched, .failed:
            Button(SettingsCopy.switchServer, action: submit)
                .disabled(because: switchReason)
        }
    }

    @ViewBuilder private var cloudButton: some View {
        if !model.isOnDefaultServer {
            switch layout {
            case .row:
                Button(SettingsCopy.useTodzCloud, action: useTodzCloud)
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .disabled(because: busyReason)
            case .column:
                Button(SettingsCopy.useTodzCloud, action: useTodzCloud)
                    .buttonStyle(.plain)
                    .disabled(because: busyReason)
            }
        }
    }

    @ViewBuilder private var statusLine: some View {
        if let status {
            Text(status.text)
                .foregroundStyle(status.isRefusal ? .red : .secondary)
                .textSelection(.enabled)
        }
    }

    private var status: (text: String, isRefusal: Bool)? {
        switch flow.state {
        case let .refused(issue): (issue.copy, true)
        case .notTodz: (ErrorCopy.notTodzServer, true)
        case let .answersAs(origin): (ErrorCopy.serverNamedOther(origin: origin), true)
        case .failed(.eraseFailed): (ErrorCopy.serverSwitchFailed(server: serverInUseName), true)
        case .failed(.busy): (ErrorCopy.serverSwitchBusy(server: serverInUseName), true)
        case .alreadyInUse: (SettingsCopy.serverInUse, false)
        case let .switched(server): layout == .row ? (SettingsCopy.switched(server: server), false) : nil
        case .idle, .checking, .confirming, .switching: nil
        }
    }

    private var serverInUseName: String {
        ServerName.of(address: model.serverURL)
    }

    private var isInFlight: Bool {
        switch flow.state {
        case .checking, .confirming, .switching: true
        case .idle, .refused, .notTodz, .answersAs, .alreadyInUse, .switched, .failed: false
        }
    }

    private var isBusyElsewhere: Bool {
        model.isSigningIn || model.isRequestingLink
    }

    private var busyReason: String? {
        guard isBusyElsewhere || isInFlight else { return nil }
        return SettingsCopy.serverBusy
    }

    private var isTextInUse: Bool {
        (try? ServerAddress.checked(text: text).get()) == model.serverURL
    }

    private var switchReason: String? {
        guard !isBusyElsewhere else { return SettingsCopy.serverBusy }
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return SettingsCopy.serverEmpty }
        guard !isTextInUse else { return SettingsCopy.serverInUse }
        return nil
    }

    private var confirmationTitle: String {
        guard case let .confirming(losing, _) = flow.state, let target else { return hiddenDialogTitle }
        return SettingsCopy.confirmationTitle(server: ServerName.of(address: target), losing: losing)
    }

    private var confirmationMessage: String {
        guard case let .confirming(losing, signedIn) = flow.state else { return hiddenDialogTitle }
        return SettingsCopy.confirmationMessage(server: ServerName.of(address: model.serverURL), losing: losing, signedIn: signedIn)
    }

    private var isConfirming: Binding<Bool> {
        Binding {
            if case .confirming = flow.state { return true }
            return false
        } set: { isPresented in
            guard !isPresented else { return }
            flow.decline()
        }
    }

    private func submit() {
        guard switchReason == nil, let address = flow.submit(text: text, serverURL: model.serverURL) else { return }
        target = address
        check = Task {
            let outcome = await model.probeServer(address)
            guard !Task.isCancelled else { return }
            flow.receive(outcome: outcome, isSignedIn: model.isSignedIn, waitingChanges: model.waitingChangeCount)
            await switchWhenReady()
        }
    }

    private func useTodzCloud() {
        guard busyReason == nil else { return }
        target = model.defaultURL
        flow.useDefault(isSignedIn: model.isSignedIn, waitingChanges: model.waitingChangeCount)
        Task { await switchWhenReady() }
    }

    private func confirm() {
        flow.confirm()
        Task { await switchWhenReady() }
    }

    private func switchWhenReady() async {
        guard flow.state == .switching, let target else { return }
        let result = await model.switchServer(to: target)
        flow.finish(result: result, server: target)
    }

    private func cancelCheck() {
        check?.cancel()
        flow.cancel()
        isFieldFocused = true
    }

    private func close() {
        check?.cancel()
        flow.close()
    }

    private func escape() {
        guard flow.state != .checking else {
            cancelCheck()
            return
        }
        text = model.serverURL.origin
        flow.reset()
        exit()
    }

    private func present(_ state: ServerSwitchState) {
        switch state {
        case .refused, .notTodz, .answersAs, .failed:
            isFieldFocused = true
            announceStatus()
        case .switched:
            announceStatus()
        case .idle, .checking, .alreadyInUse, .confirming, .switching:
            break
        }
    }

    private func announceStatus() {
        guard let status else { return }
        AccessibilityNotification.Announcement(status.text).post()
    }
}
