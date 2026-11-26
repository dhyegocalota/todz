import SwiftUI
import TodzKit

struct NameSheet: View {
    let kind: NameSheetKind
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var failure: AppBanner?
    @FocusState private var isNameFocused: Bool

    init(kind: NameSheetKind) {
        self.kind = kind
        _name = State(initialValue: kind.initialName)
    }

    var body: some View {
        VStack(alignment: .leading) {
            Text(kind.title)
                .font(.title3)
                .bold()
            if let detail = kind.detail {
                Text(detail)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            FormField(label: SheetCopy.nameLabel, prompt: SheetCopy.nameLabel, text: $name, issue: shownIssue?.copy, isLabelShown: true, isBusy: isSaving, isFocused: $isNameFocused)
                .onSubmit(submit)
            if let failure {
                ValidationLine(text: failure.title, tone: .issue)
            }
            HStack {
                Spacer()
                FormButton(title: SheetCopy.cancel, busyTitle: nil, kind: .cancel, isBusy: false, disabledReason: nil) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                FormButton(title: kind.actionTitle, busyTitle: kind.busyTitle, kind: .primary, isBusy: isSaving, disabledReason: actionReason, action: submit)
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding()
        .frame(minWidth: FormMetrics.sheetMinimumWidth)
        .task { isNameFocused = true }
    }

    private var shownIssue: RuleIssue? {
        NameIssue.shown(name: name, serverIssue: model.ruleIssues[kind.target])
    }

    private var actionReason: String? {
        if let issueReason = NameIssue.disabledReason(name: name) { return issueReason }
        guard isUnchanged else { return nil }
        return SheetCopy.renameUnchanged
    }

    private var isSaving: Bool {
        model.writesInFlight.contains(kind.target)
    }

    private var isUnchanged: Bool {
        name.trimmingCharacters(in: .whitespacesAndNewlines) == kind.initialName
    }

    private func submit() {
        guard actionReason == nil, !isSaving else { return }
        failure = nil
        Task {
            let isSaved = await save()
            guard isSaved else {
                keepFailure()
                return
            }
            dismiss()
        }
    }

    private func save() async -> Bool {
        switch kind {
        case .newWorkspace:
            return await model.createWorkspace(name: name) != nil
        case .newProject:
            return await model.createProject(name: name) != nil
        case let .renameWorkspace(workspace):
            return await model.renameWorkspace(identifier: workspace.identifier, name: name) != nil
        case let .renameProject(project):
            return await model.renameProject(projectIdentifier: project.identifier, name: name) != nil
        }
    }

    private func keepFailure() {
        guard model.ruleIssues[kind.target] == nil else { return }
        failure = model.banner
        model.dismissBanner()
    }
}
