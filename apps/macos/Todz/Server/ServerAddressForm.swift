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
                Text(SettingsCopy.serverDetail)
                    .settingsDetail()
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
                LabeledContent(SettingsCopy.serverAddressLabel) {
                    HStack(alignment: .top) {
                        field
                        action
                    }
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
        FormField(label: SettingsCopy.serverAddressLabel, prompt: SettingsCopy.serverPlaceholder, text: $text, issue: fieldIssue, isLabelShown: false, isBusy: isInFlight, isFocused: $isFieldFocused)
            .autocorrectionDisabled()
            .onSubmit(submit)
            .onExitCommand(perform: escape)
            .onChange(of: text) {
                guard text != model.serverURL.origin else { return }
                flow.reset()
            }
    }

    @ViewBuilder private var action: some View {
        HStack {
            FormButton(title: SettingsCopy.switchServer, busyTitle: busyTitle, kind: .primary, isBusy: isWorking, disabledReason: actionReason, action: submit)
            if flow.state == .checking {
                FormButton(title: SheetCopy.cancel, busyTitle: nil, kind: .cancel, isBusy: false, disabledReason: nil, action: cancelCheck)
                    .keyboardShortcut(.cancelAction)
            }
        }
    }

    @ViewBuilder private var cloudButton: some View {
        if !model.isOnDefaultServer {
            switch layout {
            case .row:
                FormButton(title: SettingsCopy.useTodzCloud, busyTitle: nil, kind: .secondary, isBusy: false, disabledReason: busyReason, action: useTodzCloud)
                    .controlSize(.small)
            case .column:
                FormButton(title: SettingsCopy.useTodzCloud, busyTitle: nil, kind: .quiet, isBusy: false, disabledReason: busyReason, action: useTodzCloud)
            }
        }
    }

    @ViewBuilder private var statusLine: some View {
        if let status {
            ValidationLine(text: status.text, tone: status.tone)
                .textSelection(.enabled)
        }
    }

    private var fieldIssue: String? {
        guard case let .refused(issue) = flow.state else { return nil }
        return issue.copy
    }

    private var status: (text: String, tone: ValidationTone)? {
        switch flow.state {
        case .notTodz: (ErrorCopy.notTodzServer, .issue)
        case let .answersAs(origin): (ErrorCopy.serverNamedOther(origin: origin), .issue)
        case .failed(.eraseFailed): (ErrorCopy.serverSwitchFailed(server: serverInUseName), .issue)
        case .failed(.busy): (ErrorCopy.serverSwitchBusy(server: serverInUseName), .issue)
        case .alreadyInUse: (SettingsCopy.serverInUse, .note)
        case .switched: layout == .row ? (SettingsCopy.switched(server: serverInUseName), .note) : nil
        case .idle, .refused, .checking, .confirming, .switching: nil
        }
    }

    private var isWorking: Bool {
        switch flow.state {
        case .checking, .switching: true
        case .idle, .refused, .notTodz, .answersAs, .alreadyInUse, .switched, .failed, .confirming: false
        }
    }

    private var busyTitle: String {
        flow.state == .switching ? SettingsCopy.switchingServer : SettingsCopy.checkingServer
    }

    private var actionReason: String? {
        guard !isWorking else { return nil }
        guard !isInFlight else { return SettingsCopy.serverBusy }
        return switchReason
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
        flow.finish(result: result)
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
        case .switched, .idle, .checking, .alreadyInUse, .confirming, .switching:
            break
        }
    }
}
