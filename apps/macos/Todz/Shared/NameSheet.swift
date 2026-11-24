import SwiftUI
import TodzKit

private let sheetWidth: CGFloat = 320

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
                .font(.headline)
            TextField(SheetCopy.nameLabel, text: $name)
                .textFieldStyle(.roundedBorder)
                .focused($isNameFocused)
                .disabled(isSaving)
                .onSubmit(submit)
            if let issue = NameIssue.shown(name: name, serverIssue: model.ruleIssues[kind.target]) {
                Text(issue.copy)
                    .foregroundStyle(.red)
            }
            if let failure {
                Text(failure.title)
                    .foregroundStyle(.red)
            }
            HStack {
                Spacer()
                Button(SheetCopy.cancel, role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                if isSaving {
                    ProgressView()
                        .controlSize(.small)
                }
                if !isSaving {
                    Button(kind.actionTitle, action: submit)
                        .keyboardShortcut(.defaultAction)
                        .disabled(because: NameIssue.disabledReason(name: name))
                        .disabled(isUnchanged)
                }
            }
        }
        .padding()
        .frame(width: sheetWidth)
        .task { isNameFocused = true }
    }

    private var isSaving: Bool {
        model.writesInFlight.contains(kind.target)
    }

    private var isUnchanged: Bool {
        name.trimmingCharacters(in: .whitespacesAndNewlines) == kind.initialName
    }

    private func submit() {
        let isRefused = NameIssue.disabledReason(name: name) != nil || isUnchanged
        guard !isRefused, !isSaving else { return }
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
